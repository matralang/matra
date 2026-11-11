import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { loadPyodide } from "pyodide"

const require = createRequire(import.meta.url)
const indexURL = dirname(require.resolve("pyodide"))
let parserRuntime

const helpers = `
import ast
import importlib
import inspect
import json
import math
import sys

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

function importDependencies(block, info, modules) {
  const currentPackage = packageName(block)
  const dependencies = new Set()
  const resolveName = (name, line) => {
    if (modules.has(name)) {
      dependencies.add(modules.get(name))
      return true
    }
    if (info.stdlib.has(name.split(".")[0])) return true
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
    } else if (!info.stdlib.has(base.split(".")[0])) {
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

function analyzeWithRuntime(pyodide, roots, candidates) {
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
    dependencies.set(block.path, importDependencies(block, parsed, modules))
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

export async function analyzePythonModules(roots, candidates) {
  if (roots.length === 0) return { modules: [], exports: new Map() }
  parserRuntime ??= createRuntime().catch(error => {
    parserRuntime = undefined
    throw error
  })
  return analyzeWithRuntime(await parserRuntime, roots, candidates)
}

export async function loadPythonModules(roots, dependencies) {
  if (roots.length === 0) return { exports: new Map(), cleanup: async () => {} }
  const pyodide = await createRuntime()
  const proxies = []
  let directory
  try {
    const analysis = analyzeWithRuntime(pyodide, roots, [...roots, ...dependencies])
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
