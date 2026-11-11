import { createHash, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { readFile, realpath } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { loadPyodide } from "pyodide"

const require = createRequire(import.meta.url)
const indexURL = dirname(require.resolve("pyodide"))
const pyodideVersion = JSON.parse(readFileSync(join(indexURL, "package.json"), "utf8")).version
const pyodidePythonVersion = JSON.parse(readFileSync(join(indexURL, "pyodide-lock.json"), "utf8"))
  .info.python
let parserRuntime

const helpers = `
import ast
import importlib
import inspect
import json
import math
import os
import platform
import re
import sys
import zipfile
from email.parser import BytesParser
from email.policy import default

def _matra_analyze(source, filename):
    try:
        tree = ast.parse(source, filename=filename)
    except SyntaxError as error:
        return json.dumps({"error": str(error), "errorCode": "PY_SYNTAX", "line": error.lineno or 1})
    imports = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(
                {"kind": "import", "name": item.name, "line": node.lineno} for item in node.names
            )
        elif isinstance(node, ast.ImportFrom):
            imports.append({
                "kind": "from",
                "module": node.module,
                "level": node.level,
                "names": [item.name for item in node.names],
                "line": node.lineno,
            })
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id == "__import__":
                return json.dumps({
                    "error": "Dynamic imports are not supported",
                    "errorCode": "PY_IMPORT",
                    "line": node.lineno,
                })
            if isinstance(node.func, ast.Attribute) and node.func.attr == "import_module":
                return json.dumps({
                    "error": "Dynamic imports are not supported",
                    "errorCode": "PY_IMPORT",
                    "line": node.lineno,
                })
    assignments = []
    for node in tree.body:
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            if any(isinstance(target, ast.Name) and target.id == "__all__" for target in targets):
                assignments.append(node.value)
    writes = [
        node for node in ast.walk(tree)
        if isinstance(node, (ast.Assign, ast.AnnAssign, ast.AugAssign))
        and any(
            isinstance(target, ast.Name) and target.id == "__all__"
            for target in (node.targets if isinstance(node, ast.Assign) else [node.target])
        )
    ]
    exports = None
    valid_exports = len(assignments) == 1 and len(writes) == 1
    if valid_exports:
        value = assignments[0]
        if isinstance(value, (ast.List, ast.Tuple)) and all(
            isinstance(item, ast.Constant) and isinstance(item.value, str) for item in value.elts
        ):
            exports = [item.value for item in value.elts]
        else:
            valid_exports = False
    return json.dumps({
        "imports": imports,
        "exports": exports,
        "validExports": valid_exports,
        "stdlib": sorted(sys.stdlib_module_names),
    })

def _matra_wheel_info(path):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        metadata_paths = [
            name for name in names
            if name.count("/") == 1 and name.endswith(".dist-info/METADATA")
        ]
        if len(metadata_paths) != 1:
            raise ValueError("Wheel must contain one dist-info/METADATA file")
        metadata_path = metadata_paths[0]
        wheel_path = metadata_path[:-len("METADATA")] + "WHEEL"
        if wheel_path not in names:
            raise ValueError("Wheel is missing its WHEEL metadata")
        message = BytesParser(policy=default).parsebytes(archive.read(metadata_path))
        wheel = BytesParser(policy=default).parsebytes(archive.read(wheel_path))
        if wheel.get_all("Tag", []) != ["py3-none-any"]:
            raise ValueError("Only py3-none-any wheels are supported")
        data_prefix = metadata_path[:-len(".dist-info/METADATA")] + ".data/"
        for name in names:
            if "\\\\" in name or name.startswith("/"):
                raise ValueError("Wheel contains an unsafe archive path")
            parts = name.rstrip("/").split("/")
            if any(part in ("", ".", "..") for part in parts):
                raise ValueError("Wheel contains an unsafe archive path")
            if name.startswith(data_prefix):
                remainder = name[len(data_prefix):]
                category, separator, _ = remainder.partition("/")
                if not separator or category != "purelib":
                    raise ValueError("Wheel may contain only purelib .data files")
        imports_path = metadata_path[:-len("METADATA")] + "top_level.txt"
        if imports_path in names:
            imports = [
                line.strip() for line in archive.read(imports_path).decode().splitlines()
                if line.strip()
            ]
        else:
            imports = sorted({
                name.split("/")[0].removesuffix(".py")
                for name in names
                if (
                    "/" not in name and name.endswith(".py")
                    or name.count("/") == 1 and name.endswith("/__init__.py")
                )
            })
        environment = {
            "implementation_name": sys.implementation.name,
            "implementation_version": ".".join(str(item) for item in sys.implementation.version[:3]),
            "os_name": os.name,
            "platform_machine": platform.machine(),
            "platform_python_implementation": platform.python_implementation(),
            "platform_release": platform.release(),
            "platform_system": platform.system(),
            "platform_version": platform.version(),
            "python_full_version": platform.python_version(),
            "python_version": ".".join(str(item) for item in sys.version_info[:2]),
            "sys_platform": sys.platform,
            "extra": "",
        }

        def marker_value(node):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                return node.value
            if isinstance(node, ast.Name) and node.id in environment:
                return environment[node.id]
            if isinstance(node, ast.BoolOp):
                values = [marker_value(value) for value in node.values]
                if isinstance(node.op, ast.And):
                    return all(values)
                if isinstance(node.op, ast.Or):
                    return any(values)
            if isinstance(node, ast.Compare):
                left_node = node.left
                left = marker_value(left_node)
                result = True
                for operator, right_node in zip(node.ops, node.comparators):
                    right = marker_value(right_node)
                    if isinstance(operator, (ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE)):
                        if isinstance(left_node, ast.Name) and left_node.id in (
                            "python_version", "python_full_version", "implementation_version"
                        ):
                            def version_tuple(value):
                                if not re.fullmatch(r"\\d+(?:\\.\\d+)*", value):
                                    raise ValueError("Unsupported Python version marker")
                                parts = [int(part) for part in value.split(".")]
                                while len(parts) > 1 and parts[-1] == 0:
                                    parts.pop()
                                return tuple(parts)
                            left_compare, right_compare = version_tuple(left), version_tuple(right)
                        else:
                            left_compare, right_compare = left, right
                        if isinstance(operator, ast.Eq):
                            current = left_compare == right_compare
                        elif isinstance(operator, ast.NotEq):
                            current = left_compare != right_compare
                        elif isinstance(operator, ast.Lt):
                            current = left_compare < right_compare
                        elif isinstance(operator, ast.LtE):
                            current = left_compare <= right_compare
                        elif isinstance(operator, ast.Gt):
                            current = left_compare > right_compare
                        else:
                            current = left_compare >= right_compare
                    elif isinstance(operator, ast.In):
                        current = left in right
                    elif isinstance(operator, ast.NotIn):
                        current = left not in right
                    else:
                        raise ValueError("Unsupported wheel dependency marker operator")
                    result = result and current
                    left_node, left = right_node, right
                return result
            raise ValueError("Unsupported wheel dependency marker")

        requirements = []
        for requirement in message.get_all("Requires-Dist", []):
            dependency, separator, marker = requirement.partition(";")
            match = re.match(r"\\s*([A-Za-z0-9_.-]+)", dependency)
            if match and (
                not separator or marker_value(ast.parse(marker.strip(), mode="eval").body)
            ):
                requirements.append(re.sub(r"[-_.]+", "-", match.group(1)).lower())
        return json.dumps({
            "name": re.sub(r"[-_.]+", "-", message["Name"]).lower(),
            "version": message["Version"],
            "imports": imports,
            "requires": requirements,
            "dataPrefix": data_prefix,
        })

def _matra_install_wheels(paths, site_packages):
    os.makedirs(site_packages, exist_ok=True)
    for path in paths:
        with zipfile.ZipFile(path) as archive:
            info = json.loads(_matra_wheel_info(path))
            for name in archive.namelist():
                if name.endswith("/"):
                    continue
                member = name
                if name.startswith(info["dataPrefix"]):
                    remainder = name[len(info["dataPrefix"]):]
                    _, _, member = remainder.partition("/")
                target = os.path.join(site_packages, *member.split("/"))
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, "wb") as output:
                    output.write(archive.read(name))
    sys.path.insert(0, site_packages)

def _matra_validate(value, active=None):
    value_type = type(value)
    if value is None or value_type in (bool, str):
        return value
    if value_type is int:
        if abs(value) > 9007199254740991:
            raise TypeError("Python integer is outside the safe JavaScript integer range")
        return value
    if value_type is float:
        if not math.isfinite(value):
            raise TypeError("Python float must be finite")
        return value
    if active is None:
        active = set()
    if value_type not in (list, dict):
        raise TypeError("Expected Python data, not a tuple, set, bytes, or class instance")
    identity = id(value)
    if identity in active:
        raise TypeError("Cyclic Python values are not supported")
    active.add(identity)
    if value_type is list:
        for item in value:
            _matra_validate(item, active)
    else:
        for key, item in value.items():
            if type(key) is not str:
                raise TypeError("Python dictionary keys must be strings")
            _matra_validate(item, active)
    active.remove(identity)
    return value

def _matra_get_exports(module_name, expected_names):
    module = importlib.import_module(module_name)
    names = getattr(module, "__all__", None)
    if type(names) not in (list, tuple) or list(names) != list(expected_names):
        raise TypeError("__all__ must match the statically declared list or tuple of export names")
    result = {}
    for name in expected_names:
        if not hasattr(module, name):
            raise TypeError("Export does not exist: " + name)
        value = getattr(module, name)
        if inspect.isclass(value) or inspect.iscoroutinefunction(value) or inspect.isasyncgenfunction(value):
            raise TypeError("Classes and asynchronous functions cannot be exported: " + name)
        if inspect.isfunction(value) or inspect.isbuiltin(value):
            result[name] = value
        else:
            _matra_validate(value)
            result[name] = value
    return result

def _matra_call(function, args):
    _matra_validate(args)
    result = function(*args)
    if inspect.isawaitable(result):
        if inspect.iscoroutine(result):
            result.close()
        raise TypeError("Python awaitables are not supported")
    return _matra_validate(result)
`

/** @returns {Promise<import("pyodide").PyodideInterface>} */
async function createRuntime() {
  const pyodide = await loadPyodide({ indexURL })
  pyodide.runPython(helpers)
  return pyodide
}

function moduleName(block) {
  const stem = block.path.slice(0, -".py".length)
  if (stem.endsWith("/__init__")) {
    return stem.slice(0, -"/__init__".length).replaceAll("/", ".")
  }
  return stem.replaceAll("/", ".")
}

function packageName(block) {
  const name = moduleName(block)
  return block.path.endsWith("/__init__.py") ? name.split(".") : name.split(".").slice(0, -1)
}

function moduleFilePath(block) {
  if (block.path.endsWith("/__init__.py") || block.path === "__init__.py") return block.path
  return `${moduleName(block).replaceAll(".", "/")}.py`
}

function moduleError(code, block, message, cause, line = 1) {
  const error = new Error(message, { cause })
  error.code = code
  error.block = block
  error.line = line
  return error
}

function packageError(block, message, cause) {
  return moduleError("PY_PACKAGE_LOCK", block, message, cause)
}

function packageNameKey(name) {
  return name.replaceAll(/[-_.]+/g, "-").toLowerCase()
}

function validWheelPath(path) {
  return (
    typeof path === "string" &&
    path.endsWith(".whl") &&
    !isAbsolute(path) &&
    !path.includes("\\") &&
    path.split("/").every(part => part && part !== "." && part !== "..")
  )
}

function inside(root, target) {
  const path = relative(root, target)
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

async function readVerifiedWheel(root, entry, block) {
  if (
    !entry ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name) ||
    typeof entry.version !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9.+!_-]*$/.test(entry.version) ||
    !validWheelPath(entry.file) ||
    !/^[a-f0-9]{64}$/.test(entry.sha256)
  ) {
    throw packageError(block, "Invalid package entry in matra.python.lock.json")
  }
  const rootPath = await realpath(root)
  const path = resolve(rootPath, ...entry.file.split("/"))
  const resolvedPath = await realpath(path).catch(error => {
    throw packageError(block, `Python wheel not found: ${entry.file}`, error)
  })
  if (!inside(rootPath, resolvedPath)) {
    throw packageError(block, `Python wheel escapes moduleRoot: ${entry.file}`)
  }
  const bytes = await readFile(resolvedPath)
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  if (sha256 !== entry.sha256) {
    throw packageError(block, `Python wheel hash mismatch: ${entry.file}`)
  }
  const filename = entry.file.split("/").at(-1)
  if (!filename.endsWith("-py3-none-any.whl")) {
    throw packageError(block, `Only py3-none-any wheels are supported: ${filename}`)
  }
  const wheelNameVersion = filename.slice(0, -"-py3-none-any.whl".length)
  const versionSeparator = wheelNameVersion.lastIndexOf("-")
  if (
    versionSeparator < 1 ||
    packageNameKey(wheelNameVersion.slice(0, versionSeparator)) !== entry.name ||
    wheelNameVersion.slice(versionSeparator + 1) !== entry.version
  ) {
    throw packageError(block, `Wheel filename does not match lock entry: ${filename}`)
  }
  return { ...entry, bytes }
}

export async function resolvePythonPackages(moduleRoot, requirements, block) {
  if (requirements.length === 0) return []
  let lock
  try {
    lock = JSON.parse(await readFile(join(moduleRoot, "matra.python.lock.json"), "utf8"))
  } catch (error) {
    throw packageError(block, "Cannot read matra.python.lock.json", error)
  }
  if (
    lock?.format !== "matra-python-wheels-1" ||
    lock.pyodide !== pyodideVersion ||
    !Array.isArray(lock.packages)
  ) {
    throw packageError(block, `Expected a matra-python-wheels-1 lock for Pyodide ${pyodideVersion}`)
  }
  const packages = new Map()
  const files = new Set()
  for (const entry of lock.packages) {
    const packageKey = packageNameKey(entry?.name ?? "")
    if (!packageKey || packages.has(packageKey) || files.has(entry.file)) {
      throw packageError(block, "Duplicate Python package or wheel in lock file")
    }
    files.add(entry.file)
    const wheel = await readVerifiedWheel(moduleRoot, entry, block)
    packages.set(packageKey, wheel)
  }
  for (const requirement of requirements) {
    const valid =
      typeof requirement === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(requirement)
    const wheel = valid && packages.get(packageNameKey(requirement))
    if (!wheel) {
      throw packageError(block, `Package is not locked in matra.python.lock.json: ${requirement}`)
    }
  }
  return [...packages.values()]
}

function importDependencies(block, info, modules, packageImports) {
  const currentPackage = packageName(block)
  const dependencies = new Set()
  const resolveName = (name, line) => {
    if (modules.has(name)) {
      dependencies.add(modules.get(name))
      return true
    }
    if (info.stdlib.has(name.split(".")[0]) || packageImports.has(name.split(".")[0])) return true
    throw moduleError(
      "PY_IMPORT",
      block,
      `Import is not a document module or Python standard library: ${name}`,
      undefined,
      line,
    )
  }
  for (const imported of info.imports) {
    if (imported.kind === "import") {
      resolveName(imported.name, imported.line)
      continue
    }
    let base = imported.module
    if (imported.level) {
      const parentLength = currentPackage.length - imported.level + 1
      if (currentPackage.length === 0 || parentLength < 0) {
        throw moduleError(
          "PY_IMPORT",
          block,
          "Relative import escapes the document module path",
          undefined,
          imported.line,
        )
      }
      base = [...currentPackage.slice(0, parentLength), ...(base ? base.split(".") : [])].join(".")
    }
    if (!base) {
      for (const name of imported.names) {
        const target = name
        if (!modules.has(target)) {
          throw moduleError(
            "PY_IMPORT",
            block,
            `Document module not found: ${target}`,
            undefined,
            imported.line,
          )
        }
        dependencies.add(modules.get(target))
      }
    } else if (modules.has(base)) {
      dependencies.add(modules.get(base))
      for (const name of imported.names) {
        const target = `${base}.${name}`
        if (modules.has(target)) dependencies.add(modules.get(target))
      }
    } else if (!info.stdlib.has(base.split(".")[0]) && !packageImports.has(base.split(".")[0])) {
      const nested = imported.names.map(name => `${base}.${name}`).filter(name => modules.has(name))
      if (nested.length === 0) {
        throw moduleError(
          "PY_IMPORT",
          block,
          `Import is not a document module or Python standard library: ${base}`,
          undefined,
          imported.line,
        )
      }
      for (const name of nested) dependencies.add(modules.get(name))
    }
  }
  return [...dependencies]
}

function inspectWheelsWithRuntime(pyodide, packages, block) {
  const packageImports = new Set()
  const lockedPackages = new Set(packages.map(item => packageNameKey(item.name)))
  const wheelDirectory = `/tmp/matra-wheel-check-${randomUUID()}`
  pyodide.FS.mkdirTree(wheelDirectory)
  try {
    for (const [index, packageInfo] of packages.entries()) {
      const path = `${wheelDirectory}/${index}.whl`
      pyodide.FS.writeFile(path, packageInfo.bytes)
      pyodide.globals.set("_matra_wheel_path", path)
      let raw
      try {
        raw = pyodide.runPython("_matra_wheel_info(_matra_wheel_path)")
      } finally {
        pyodide.globals.set("_matra_wheel_path", null)
      }
      const info = JSON.parse(raw)
      if (info.name !== packageNameKey(packageInfo.name) || info.version !== packageInfo.version) {
        throw packageError(block, `Wheel metadata does not match lock entry: ${packageInfo.file}`)
      }
      if (
        info.imports.some(name => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) ||
        info.requires.some(name => !lockedPackages.has(name))
      ) {
        throw packageError(
          block,
          `Wheel has invalid imports or an unlocked dependency: ${packageInfo.file}`,
        )
      }
      for (const name of info.imports) packageImports.add(name)
    }
  } catch (error) {
    if (error.code) throw error
    throw packageError(
      block,
      `Cannot inspect a locked Python wheel: ${error.message ?? String(error)}`,
      error,
    )
  } finally {
    for (const name of pyodide.FS.readdir(wheelDirectory)) {
      if (name.endsWith(".whl")) pyodide.FS.unlink(`${wheelDirectory}/${name}`)
    }
    pyodide.FS.rmdir(wheelDirectory)
  }
  return packageImports
}

export function getPythonPackageTarget() {
  return { pyodide: pyodideVersion, python: pyodidePythonVersion }
}

export async function validatePythonWheels(packages, block) {
  if (packages.length === 0) return
  parserRuntime ??= createRuntime().catch(error => {
    parserRuntime = undefined
    throw error
  })
  inspectWheelsWithRuntime(await parserRuntime, packages, block)
}

function analyzeWithRuntime(pyodide, roots, candidates, packages = []) {
  const modules = new Map()
  for (const block of candidates) {
    const name = moduleName(block)
    if (name.split(".").some(part => !/^[A-Za-z_]\w*$/.test(part))) {
      throw moduleError("PY_MODULE_NAME", block, `Invalid Python module name: ${name}`)
    }
    if (modules.has(name)) {
      throw moduleError("PY_DUPLICATE_MODULE", block, `Duplicate Python module name: ${name}`)
    }
    modules.set(name, block)
  }
  const infos = new Map()
  const stdlibProxy = pyodide.runPython("list(sys.stdlib_module_names)")
  let stdlib
  try {
    stdlib = new Set(stdlibProxy.toJs())
  } finally {
    stdlibProxy.destroy()
  }
  const packageImports = inspectWheelsWithRuntime(pyodide, packages, roots[0])
  const dependencies = new Map()
  const parseBlock = block => {
    if (infos.has(block.path)) return infos.get(block.path)
    pyodide.globals.set("_matra_source", block.source)
    pyodide.globals.set("_matra_filename", moduleName(block))
    let result
    try {
      result = pyodide.runPython("_matra_analyze(_matra_source, _matra_filename)")
    } finally {
      pyodide.globals.set("_matra_source", null)
      pyodide.globals.set("_matra_filename", null)
    }
    const info = JSON.parse(result)
    if (info.error) {
      throw moduleError(info.errorCode ?? "PY_SYNTAX", block, info.error, undefined, info.line)
    }
    const parsed = { ...info, stdlib }
    infos.set(block.path, parsed)
    dependencies.set(block.path, importDependencies(block, parsed, modules, packageImports))
    return parsed
  }
  const complete = new Set()
  const active = new Set()
  const selected = new Set(roots.map(block => block.path))
  const included = new Map()
  const exports = new Map()
  const visit = block => {
    if (complete.has(block.path)) return
    if (active.has(block.path)) {
      throw moduleError("PY_MODULE_CYCLE", block, "Cyclic Python module dependency")
    }
    active.add(block.path)
    parseBlock(block)
    for (const dependency of dependencies.get(block.path)) visit(dependency)
    active.delete(block.path)
    complete.add(block.path)
    if (!selected.has(block.path)) included.set(block.path, block)
  }
  for (const block of roots) {
    const info = parseBlock(block)
    if (!info.validExports || !Array.isArray(info.exports)) {
      throw moduleError("PY_EXPORT", block, "__all__ must be a literal list or tuple of strings")
    }
    if (new Set(info.exports).size !== info.exports.length) {
      throw moduleError("PY_EXPORT", block, "__all__ cannot contain duplicate names")
    }
    for (const name of info.exports) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
        throw moduleError("PY_EXPORT", block, `Invalid Python export name: ${name}`)
      }
    }
    exports.set(block.path, info.exports)
    visit(block)
  }
  return {
    modules: [...included.values()].sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    ),
    exports,
    infos,
  }
}

export async function analyzePythonModules(roots, candidates, packages = []) {
  if (roots.length === 0) return { modules: [], exports: new Map() }
  parserRuntime ??= createRuntime().catch(error => {
    parserRuntime = undefined
    throw error
  })
  return analyzeWithRuntime(await parserRuntime, roots, candidates, packages)
}

export async function loadPythonModules(roots, dependencies, packages, moduleRoot) {
  if (roots.length === 0) return { exports: new Map(), cleanup: async () => {} }
  const wheelFiles = await Promise.all(
    packages.map(packageInfo => readVerifiedWheel(moduleRoot, packageInfo, roots[0])),
  )
  const pyodide = await createRuntime()
  const proxies = []
  let directory
  try {
    const analysis = analyzeWithRuntime(pyodide, roots, [...roots, ...dependencies], wheelFiles)
    const expected = analysis.modules.map(block => block.path).sort()
    const actual = dependencies.map(block => block.path).sort()
    if (
      expected.length !== actual.length ||
      expected.some((path, index) => path !== actual[index])
    ) {
      throw moduleError(
        "INVALID_BUNDLE",
        roots[0],
        "Python module dependencies do not match document imports",
      )
    }
    directory = `/tmp/matra-${randomUUID()}`
    pyodide.FS.mkdirTree(directory)
    for (const block of [...roots, ...dependencies]) {
      const path = join(directory, ...moduleFilePath(block).split("/"))
      const parent = path.slice(0, path.lastIndexOf("/"))
      pyodide.FS.mkdirTree(parent)
      pyodide.FS.writeFile(path, block.source, { encoding: "utf8" })
    }
    const wheelDirectory = `${directory}/wheels`
    pyodide.FS.mkdirTree(wheelDirectory)
    const wheelPaths = []
    for (const [index, packageInfo] of wheelFiles.entries()) {
      const path = `${wheelDirectory}/${index}.whl`
      pyodide.FS.writeFile(path, packageInfo.bytes)
      wheelPaths.push(path)
    }
    pyodide.globals.set("_matra_wheel_paths", pyodide.toPy(wheelPaths))
    pyodide.globals.set("_matra_site_packages", `${directory}/site-packages`)
    pyodide.runPython("_matra_install_wheels(_matra_wheel_paths, _matra_site_packages)")
    pyodide.globals.set("_matra_wheel_paths", null)
    pyodide.globals.set("_matra_site_packages", null)
    pyodide.globals.set("_matra_python_path", directory)
    pyodide.runPython("sys.path.insert(0, _matra_python_path)")
    const getExports = pyodide.globals.get("_matra_get_exports")
    proxies.push(getExports)
    const callHelper = pyodide.globals.get("_matra_call")
    proxies.push(callHelper)
    const exports = new Map()
    for (const block of roots) {
      const name = moduleName(block)
      const exportNames = analysis.exports.get(block.path)
      const expectedNames = pyodide.toPy(exportNames)
      let raw
      try {
        raw = getExports(name, expectedNames)
      } finally {
        expectedNames.destroy()
      }
      const nestedProxies = []
      let values
      try {
        values = raw.toJs({
          dict_converter: Object.fromEntries,
          pyproxies: nestedProxies,
        })
      } finally {
        proxies.push(raw, ...nestedProxies)
      }
      exports.set(block.path, values)
    }
    return {
      exports,
      exportNames: analysis.exports,
      wrapFunction: functionValue => wrapPythonFunction(functionValue, pyodide, callHelper),
      cleanup: async () => {
        for (const proxy of proxies) proxy.destroy()
      },
    }
  } catch (error) {
    for (const proxy of proxies) proxy.destroy()
    throw error
  }
}

/**
 * @param {Function} functionValue
 * @param {import("pyodide").PyodideInterface} pyodide
 * @param {Function} callHelper
 */
function wrapPythonFunction(functionValue, pyodide, callHelper) {
  return (...args) => {
    const pythonArgs = pyodide.toPy(args)
    try {
      const result = callHelper(functionValue, pythonArgs)
      if (typeof result === "object" && result !== null && typeof result.toJs === "function") {
        try {
          return result.toJs({
            dict_converter: Object.fromEntries,
            create_pyproxies: false,
          })
        } finally {
          result.destroy()
        }
      }
      return result
    } finally {
      pythonArgs.destroy()
    }
  }
}
