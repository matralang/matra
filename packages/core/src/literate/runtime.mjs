import { mkdir, mkdtemp, rm, stat, symlink, writeFile } from "node:fs/promises"
import { isBuiltin } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, posix as posixPath, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { types } from "node:util"
import { createContext, Script } from "node:vm"
import { parse as parseJavaScript } from "acorn"
import { load as loadYaml } from "js-yaml"
import { LITERATE_ABI, loadCompiler } from "./compiler.mjs"
import { formatCompilerDiagnostic, reserveCompilerWorkspace } from "./compiler-host.mjs"
import { analyzePythonModules, loadPythonModules } from "./python-runtime.mjs"
import { instantiateMatra } from "./value-host.mjs"

export class LiterateError extends Error {
  /**
   * @param {string} code
   * @param {{ document: string, path: string, line: number }} block
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor(code, block, message, cause) {
    super(`${block.document}:${block.line}:1 (${block.path}): ${message}`, { cause })
    this.name = "LiterateError"
    this.code = code
    this.document = block.document
    this.path = block.path
    this.line = block.line
  }
}

function fail(code, block, message, cause) {
  throw new LiterateError(code, block, message, cause)
}

function publicName(block) {
  if (block.path.endsWith(".py")) {
    const stem = block.path.slice(0, -".py".length)
    const packagePath = stem.endsWith("/__init__") ? stem.slice(0, -"/__init__".length) : stem
    return packagePath.split(/[/.]/)
  }
  const suffix = block.path.endsWith(".js.part") ? ".js.part" : ".js"
  return block.path.slice(0, -suffix.length).split("/")
}

function expression(block) {
  try {
    return new Script(`"use strict";\n(\n${block.source}\n)`, {
      filename: `${block.document} (${block.path})`,
      lineOffset: block.line - 3,
    })
  } catch (error) {
    fail("JS_SYNTAX", block, error.message, error)
  }
}

function moduleSyntax(block) {
  try {
    return parseJavaScript(block.source, { ecmaVersion: "latest", sourceType: "module" })
  } catch (error) {
    const line = block.line + (error.loc?.line ?? 1) - 1
    fail("JS_SYNTAX", { ...block, line }, error.message, error)
  }
}

function visitJavaScript(node, visitor) {
  if (!node || typeof node !== "object") return
  if (Array.isArray(node)) {
    for (const item of node) visitJavaScript(item, visitor)
    return
  }
  if (typeof node.type !== "string") return
  visitor(node)
  for (const [key, value] of Object.entries(node)) {
    if (key !== "start" && key !== "end" && key !== "loc") visitJavaScript(value, visitor)
  }
}

function rejectTopLevelAwait(node, block, functionDepth = 0) {
  if (!node || typeof node !== "object") return
  if (Array.isArray(node)) {
    for (const item of node) rejectTopLevelAwait(item, block, functionDepth)
    return
  }
  if (typeof node.type !== "string") return
  const nested =
    functionDepth +
    Number(
      node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "ArrowFunctionExpression",
    )
  if (
    (node.type === "AwaitExpression" || (node.type === "ForOfStatement" && node.await)) &&
    !nested
  ) {
    fail("UNSUPPORTED_ASYNC", block, "Top-level await is not supported")
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== "start" && key !== "end" && key !== "loc") {
      rejectTopLevelAwait(value, block, nested)
    }
  }
}

function moduleImports(block, blocks) {
  const syntax = moduleSyntax(block)
  rejectTopLevelAwait(syntax, block)
  const imports = []
  visitJavaScript(syntax, node => {
    if (node.type === "ImportExpression") {
      fail("UNSUPPORTED_IMPORT", block, "Dynamic import() is not supported")
    }
    let source
    if (node.type === "ImportDeclaration" || node.type === "ExportAllDeclaration") {
      source = node.source.value
      if (node.attributes?.length) {
        fail("UNSUPPORTED_IMPORT", block, "Import attributes are not supported")
      }
    } else if (node.type === "ExportNamedDeclaration" && node.source) {
      source = node.source.value
    }
    if (source === undefined) return
    if (typeof source !== "string") {
      fail("UNSUPPORTED_IMPORT", block, "Module specifier must be a string")
    }
    if (!source.startsWith("./") && !source.startsWith("../")) {
      const parts = source.split("/")
      if (
        source.startsWith("#") ||
        source.startsWith("/") ||
        source.includes("\\") ||
        source.includes("?") ||
        source.includes("#") ||
        source.includes(":") ||
        /\s/.test(source) ||
        isBuiltin(source) ||
        parts.some(part => !part || part === "." || part === "..") ||
        (source.startsWith("@") && (parts.length < 2 || parts[0].length < 2))
      ) {
        fail("UNSUPPORTED_IMPORT", block, `Unsupported module specifier: ${source}`)
      }
      return
    }
    if (
      source.includes("\\") ||
      source.includes("?") ||
      source.includes("#") ||
      !source.endsWith(".js")
    ) {
      fail("UNSUPPORTED_IMPORT", block, `Only relative .js imports are supported: ${source}`)
    }
    const target = posixPath.normalize(posixPath.join(posixPath.dirname(block.path), source))
    if (
      target === "." ||
      target === ".." ||
      target.startsWith("../") ||
      posixPath.isAbsolute(target)
    ) {
      fail("INVALID_PATH", block, `Import escapes the document: ${source}`)
    }
    const imported = blocks.get(target.toLowerCase())
    if (!imported || imported.path !== target || !target.endsWith(".js")) {
      fail("MODULE_RESOLUTION", block, `Relative module not found: ${source}`)
    }
    imports.push(imported)
  })
  return imports
}

function collectModules(roots, blocks) {
  const complete = new Set()
  const active = new Set()
  const dependencies = new Map()
  const visit = block => {
    if (complete.has(block.path)) return
    if (active.has(block.path)) fail("MODULE_CYCLE", block, "Cyclic module dependency")
    active.add(block.path)
    for (const dependency of moduleImports(block, blocks)) visit(dependency)
    active.delete(block.path)
    complete.add(block.path)
    dependencies.set(block.path, block)
  }
  for (const root of roots) visit(root)
  const rootPaths = new Set(roots.map(block => block.path))
  return [...dependencies.values()]
    .filter(block => !rootPaths.has(block.path))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

function boundNames(pattern) {
  if (!pattern) return []
  if (pattern.type === "Identifier") return [pattern.name]
  if (pattern.type === "RestElement") return boundNames(pattern.argument)
  if (pattern.type === "AssignmentPattern") return boundNames(pattern.left)
  if (pattern.type === "ArrayPattern") return pattern.elements.flatMap(boundNames)
  if (pattern.type === "ObjectPattern") {
    return pattern.properties.flatMap(property =>
      property.type === "RestElement" ? boundNames(property.argument) : boundNames(property.value),
    )
  }
  return []
}

function moduleExportNames(block, blocks, cache = new Map()) {
  if (cache.has(block.path)) return cache.get(block.path)
  const names = new Set()
  cache.set(block.path, names)
  const syntax = moduleSyntax(block)
  for (const node of syntax.body) {
    if (node.type === "ExportDefaultDeclaration") {
      names.add("default")
    } else if (node.type === "ExportNamedDeclaration") {
      if (node.declaration) {
        const declaration = node.declaration
        if (declaration.id) names.add(declaration.id.name)
        if (declaration.type === "VariableDeclaration") {
          for (const item of declaration.declarations) {
            for (const name of boundNames(item.id)) names.add(name)
          }
        }
      }
      for (const item of node.specifiers) names.add(item.exported.name ?? item.exported.value)
    } else if (node.type === "ExportAllDeclaration") {
      if (node.exported) {
        names.add(node.exported.name ?? node.exported.value)
      } else {
        if (!node.source.value.startsWith("./") && !node.source.value.startsWith("../")) {
          return null
        }
        const dependency = moduleImports(block, blocks).find(
          imported =>
            posixPath.normalize(
              posixPath.join(posixPath.dirname(block.path), node.source.value),
            ) === imported.path,
        )
        if (dependency) {
          for (const name of moduleExportNames(dependency, blocks, cache)) {
            if (name !== "default") names.add(name)
          }
        }
      }
    }
  }
  return names
}

function publicBindings(selected, blocks, pythonExports = new Map()) {
  const bindings = []
  const add = (parts, block) => {
    if (parts.some(part => !/^[A-Za-z_$][\w$]*$/.test(part))) {
      fail("INVALID_EXPORT", block, "Export names must be JavaScript identifiers")
    }
    bindings.push({ parts, block })
  }
  for (const block of selected) {
    const parts = publicName(block)
    if (block.path.endsWith(".js.part")) {
      add(parts, block)
      continue
    }
    if (block.path.endsWith(".py")) {
      for (const name of pythonExports.get(block.path) ?? []) add([...parts, name], block)
      continue
    }
    const exportedNames = moduleExportNames(block, blocks)
    if (exportedNames === null) continue
    const names = [...exportedNames].sort()
    if (names.length === 0) fail("NO_EXPORTS", block, "Selected module has no exports")
    if (names.includes("default")) {
      if (names.length !== 1) {
        fail("MIXED_EXPORTS", block, "A module must use either a default export or named exports")
      }
      add(parts, block)
    } else {
      for (const name of names) add([...parts, name], block)
    }
  }
  const names = []
  for (const { parts, block } of bindings) {
    const name = parts.join(".")
    if (
      names.some(
        other => name === other || name.startsWith(`${other}.`) || other.startsWith(`${name}.`),
      )
    ) {
      fail("PUBLIC_NAME_COLLISION", block, `Conflicting public name: ${name}`)
    }
    names.push(name)
  }
}

function frontMatterConfig(markdown, document) {
  const opening = /^(?:\uFEFF)?---[ \t]*\r?\n/.exec(markdown)
  const location = { document, path: "<frontmatter>", line: 1 }
  if (!opening)
    fail("FRONTMATTER_REQUIRED", location, "Document configuration must be in YAML front matter")
  const rest = markdown.slice(opening[0].length)
  const closing = /(?:^|\r?\n)---[ \t]*(?:\r?\n|$)/.exec(rest)
  if (!closing) fail("INVALID_FRONTMATTER", location, "Unclosed YAML front matter")
  const source = rest.slice(0, closing.index)
  let metadata
  try {
    metadata = loadYaml(source)
  } catch (error) {
    const line = (error.mark?.line ?? 0) + 2
    fail("INVALID_FRONTMATTER", { ...location, line }, error.message, error)
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    fail("INVALID_FRONTMATTER", location, "Front matter must be a mapping")
  }
  const config = metadata.matra
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    fail("INVALID_FRONTMATTER", location, "Front matter must define a matra mapping")
  }
  if (typeof config.entry !== "string" || config.entry.length === 0) {
    fail("INVALID_FRONTMATTER", location, "matra.entry must be a non-empty path")
  }
  const values = config.values === undefined ? [] : config.values
  if (!Array.isArray(values) || values.some(value => typeof value !== "string")) {
    fail("INVALID_FRONTMATTER", location, "matra.values must be a list of paths")
  }
  const bodyOffset = opening[0].length + closing.index + closing[0].length
  const bodyLine = markdown.slice(0, bodyOffset).split("\n").length - 1
  return { entry: config.entry, values, bodyLine }
}

export function registerLiterate(markdown, options = {}) {
  const { document = "<markdown>" } = options
  if (Object.hasOwn(options, "entry") || Object.hasOwn(options, "values")) {
    fail(
      "INVALID_OPTIONS",
      { document, path: "<options>", line: 1 },
      "Configure entry and values in YAML front matter",
    )
  }
  const { entry, values, bodyLine } = frontMatterConfig(markdown, document)
  const collected = []
  const lines = markdown.replaceAll("\r\n", "\n").split("\n")
  for (let index = bodyLine; index < lines.length; index++) {
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[index])
    if (!opening) continue
    const delimiter = opening[1]
    const path = opening[2].trim()
    const block = { document, path, line: index + 2 }
    const start = index + 1
    const closing = new RegExp(`^ {0,3}${delimiter[0]}{${delimiter.length},}[ \\t]*$`)
    while (++index < lines.length && !closing.test(lines[index])) {}
    if (index === lines.length) fail("UNCLOSED_FENCE", block, "Unclosed code fence")
    if (!path.includes(".") && !path.includes("/") && !path.includes("?")) continue
    block.source = lines.slice(start, index).join("\n")
    collected.push(block)
  }
  return selectBlocks(collected, { document, entry, values })
}

function selectBlocks(collected, { document, entry, values }) {
  const blocks = new Map()
  const valueNames = []
  const valueBlocks = new Map()
  const moduleNames = new Set()
  for (const block of collected) {
    const { path } = block
    if (path.endsWith(".partial.js"))
      fail("INVALID_PATH", block, "Use .js.part instead of .partial.js")
    if (path.includes("?")) fail("UNSUPPORTED_FORMAT", block, "Argument headers are not supported")
    if (
      !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)*$/.test(
        path,
      )
    ) {
      fail("INVALID_PATH", block, "Expected an ASCII identifier-based relative virtual path")
    }
    const key = path.toLowerCase()
    if (blocks.has(key)) fail("DUPLICATE_PATH", block, `Duplicate virtual path: ${path}`)
    blocks.set(key, block)
    if (path.endsWith(".js.part")) {
      const parts = publicName(block)
      if (parts.some(part => !/^[A-Za-z_$][\w$]*$/.test(part))) {
        fail("INVALID_PATH", block, "Public path components must be identifiers")
      }
      const name = parts.join(".")
      if (
        valueNames.some(
          other => name === other || name.startsWith(`${other}.`) || other.startsWith(`${name}.`),
        )
      ) {
        fail("PUBLIC_NAME_COLLISION", block, `Conflicting public name: ${name}`)
      }
      valueNames.push(name)
      valueBlocks.set(name, block)
    } else if (path.endsWith(".js") || path.endsWith(".py")) {
      moduleNames.add(publicName(block).join("."))
    }
  }
  for (const name of valueNames) {
    if (moduleNames.has(name)) {
      fail("PUBLIC_NAME_COLLISION", valueBlocks.get(name), `Conflicting public name: ${name}`)
    }
  }
  const select = (path, suffix) => {
    const block = blocks.get(typeof path === "string" ? path.toLowerCase() : "")
    const location = { document, path: path ?? "<entry>", line: 1 }
    if (!block || block.path !== path) fail("NOT_FOUND", location, "Virtual file not found")
    if (!path.endsWith(suffix)) fail("UNSUPPORTED_FORMAT", block, `Expected ${suffix}`)
    return block
  }
  const main = select(entry, ".matra")
  if (new Set(values).size !== values.length) {
    fail("DUPLICATE_SELECTION", main, "A value was selected more than once")
  }
  const selected = values.map(path => {
    if (typeof path === "string" && path.endsWith(".js")) return select(path, ".js")
    if (typeof path === "string" && path.endsWith(".js.part")) return select(path, ".js.part")
    if (typeof path === "string" && path.endsWith(".py")) return select(path, ".py")
    const block = blocks.get(typeof path === "string" ? path.toLowerCase() : "")
    if (!block)
      return fail(
        "NOT_FOUND",
        { document, path: path ?? "<value>", line: 1 },
        "Virtual file not found",
      )
    return fail("UNSUPPORTED_FORMAT", block, "Expected .js, .js.part, or .py")
  })
  selected.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  for (const block of selected) {
    if (block.path.endsWith(".js.part")) expression(block)
  }
  const roots = selected.filter(block => block.path.endsWith(".js"))
  const modules = collectModules(roots, blocks)
  publicBindings(selected, blocks)
  return {
    entry: main,
    values: selected,
    modules,
    pythonBlocks: [...blocks.values()].filter(block => block.path.endsWith(".py")),
  }
}

/** @returns {Promise<import("../literate.js").LiterateBundle>} */
export async function buildLiterate(markdown, options = {}) {
  const registration = registerLiterate(markdown, options)
  const { entry, values, pythonBlocks, ...bundleRegistration } = registration
  const pythonRoots = values.filter(block => block.path.endsWith(".py"))
  let python
  try {
    python = await analyzePythonModules(pythonRoots, pythonBlocks)
  } catch (error) {
    if (error instanceof LiterateError) throw error
    const block = error.block ?? pythonRoots[0] ?? entry
    fail(
      error.code ?? "PY_BUILD",
      { ...block, line: block.line + (error.line ?? 1) - 1 },
      error.message ?? String(error),
      error,
    )
  }
  publicBindings(
    values,
    new Map([...values, ...pythonBlocks].map(block => [block.path, block])),
    python?.exports,
  )
  let compiler
  try {
    compiler = await loadCompiler()
  } catch (error) {
    fail("COMPILER_LOAD", entry, error.message, error)
  }
  const { alloc, compile, memory } = compiler.instance.exports
  const source = new TextEncoder().encode("\n".repeat(entry.line - 1) + entry.source)
  memory.grow(Math.ceil(source.length / 65536) + 2)
  const pointer = alloc(source.length)
  new Uint8Array(memory.buffer, pointer, source.length).set(source)
  reserveCompilerWorkspace(compiler.instance.exports, pointer, source.length)
  const result = compile(pointer, source.length)
  const record = new DataView(memory.buffer, result, 36)
  if (record.getInt32(0, true) !== 0) {
    fail("MATRA_COMPILE", entry, formatCompilerDiagnostic(source, memory, result, entry.document))
  }
  const wasm = Buffer.from(
    new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true)),
  ).toString("base64")
  return {
    format: "matra-literate-1",
    abi: LITERATE_ABI,
    ...bundleRegistration,
    entry,
    values,
    ...(pythonRoots.length ? { pythonModules: python.modules } : {}),
    wasm,
  }
}

function copyValue(
  value,
  { block, prototypes, functions, functionResults = functions, active = new Set() },
) {
  const next = (item, allowFunctions = functions) =>
    copyValue(item, { block, prototypes, functions: allowFunctions, functionResults, active })
  const invalid = message => fail("UNSUPPORTED_VALUE", block, message)
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "function" && functions) {
    return (...args) => {
      try {
        const input = args.map(arg => copyValue(arg, { block, prototypes, functions: false }))
        return next(Reflect.apply(value, undefined, input), functionResults)
      } catch (error) {
        if (error instanceof LiterateError) throw error
        fail("JS_CALL", block, error?.message ?? String(error), error)
      }
    }
  }
  if (typeof value !== "object") invalid(`Unsupported value type: ${typeof value}`)
  if (types.isPromise(value)) {
    // 境界で拒否したPromiseのrejectionを二次的な未処理エラーにしない。
    Promise.prototype.then.call(
      value,
      () => {},
      () => {},
    )
    invalid("Promises and asynchronous work are not supported")
  }
  if (types.isProxy(value)) invalid("Proxies are not supported")
  if (active.has(value)) invalid("Cyclic values are not supported")
  const array = Array.isArray(value)
  const allowed = array
    ? [Array.prototype, prototypes.array]
    : [null, Object.prototype, prototypes.object]
  if (!allowed.includes(Object.getPrototypeOf(value))) {
    invalid("Only plain objects and arrays are supported")
  }
  for (let current = value; current !== null; current = Object.getPrototypeOf(current)) {
    const then = Object.getOwnPropertyDescriptor(current, "then")
    if (then && (!Object.hasOwn(then, "value") || typeof then.value === "function")) {
      invalid("Thenables and asynchronous work are not supported")
    }
  }
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Reflect.ownKeys(descriptors)
  for (const key of keys) {
    if (array && key === "length") continue
    const descriptor = descriptors[key]
    if (typeof key !== "string" || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      invalid("Expected enumerable string-keyed data properties")
    }
  }
  if (
    array &&
    (keys.length !== value.length + 1 ||
      keys.some(key => key !== "length" && !/^(0|[1-9]\d*)$/.test(key)))
  ) {
    invalid("Expected a dense array without extra properties")
  }
  active.add(value)
  const result = array ? [] : {}
  for (const key of keys) {
    if (array && key === "length") continue
    Object.defineProperty(result, key, {
      value: next(descriptors[key].value),
      enumerable: true,
      writable: true,
      configurable: true,
    })
  }
  active.delete(value)
  return result
}

function bindPublicValue(globals, parts, value, block) {
  let target = globals
  for (const part of parts.slice(0, -1)) {
    if (!Object.hasOwn(target, part)) target[part] = Object.create(null)
    if (target[part] === null || typeof target[part] !== "object" || Array.isArray(target[part])) {
      fail("PUBLIC_NAME_COLLISION", block, `Conflicting public name: ${parts.join(".")}`)
    }
    target = target[part]
  }
  const name = parts.at(-1)
  if (Object.hasOwn(target, name)) {
    fail("PUBLIC_NAME_COLLISION", block, `Conflicting public name: ${parts.join(".")}`)
  }
  target[name] = value
}

async function loadStandardModules(roots, dependencies, globals, prototypes, moduleRoot) {
  if (roots.length === 0) return async () => {}
  const directory = await mkdtemp(join(tmpdir(), "matra-literate-"))
  let current = roots[0]
  try {
    await writeFile(join(directory, "package.json"), '{"type":"module"}', "utf8")
    const nodeModules = join(resolve(moduleRoot), "node_modules")
    try {
      if ((await stat(nodeModules)).isDirectory()) {
        await symlink(
          nodeModules,
          join(directory, "node_modules"),
          process.platform === "win32" ? "junction" : "dir",
        )
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
    for (const block of [...roots, ...dependencies]) {
      const file = join(directory, ...block.path.split("/"))
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, block.source, "utf8")
    }
    for (const block of roots) {
      current = block
      const file = join(directory, ...block.path.split("/"))
      const namespace = await import(pathToFileURL(file).href)
      const exports = Object.keys(namespace).sort()
      if (exports.length === 0) fail("NO_EXPORTS", block, "Selected module has no exports")
      if (exports.includes("default")) {
        if (exports.length !== 1) {
          fail("MIXED_EXPORTS", block, "A module must use either a default export or named exports")
        }
        bindPublicValue(
          globals,
          publicName(block),
          copyValue(namespace.default, {
            block,
            prototypes,
            functions: typeof namespace.default === "function",
            functionResults: false,
          }),
          block,
        )
      } else {
        for (const name of exports) {
          if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
            fail("INVALID_EXPORT", block, `Export name is not a JavaScript identifier: ${name}`)
          }
          bindPublicValue(
            globals,
            [...publicName(block), name],
            copyValue(namespace[name], {
              block,
              prototypes,
              functions: typeof namespace[name] === "function",
              functionResults: false,
            }),
            block,
          )
        }
      }
    }
    return () => rm(directory, { recursive: true, force: true })
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    if (error instanceof LiterateError) throw error
    fail("JS_INITIALIZE", current, error?.message ?? String(error), error)
  }
}

function validateBundle(bundle) {
  const location = { document: "<bundle>", path: "<bundle>", line: 1 }
  const validBlock = block =>
    block &&
    typeof block.document === "string" &&
    typeof block.path === "string" &&
    typeof block.source === "string" &&
    Number.isSafeInteger(block.line) &&
    block.line >= 1
  if (
    bundle?.format !== "matra-literate-1" ||
    bundle.abi !== LITERATE_ABI ||
    !validBlock(bundle.entry) ||
    !Array.isArray(bundle.values) ||
    !bundle.values.every(validBlock) ||
    (bundle.modules !== undefined &&
      (!Array.isArray(bundle.modules) || !bundle.modules.every(validBlock))) ||
    (bundle.pythonModules !== undefined &&
      (!Array.isArray(bundle.pythonModules) || !bundle.pythonModules.every(validBlock))) ||
    typeof bundle.wasm !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(bundle.wasm)
  ) {
    fail("INVALID_BUNDLE", location, "Invalid or unsupported literate bundle")
  }
  // 保存済みbundleにも登録時と同じ選択・衝突規則を適用する。
  const registered = selectBlocks(
    [bundle.entry, ...bundle.values, ...(bundle.modules ?? []), ...(bundle.pythonModules ?? [])],
    {
      document: bundle.entry.document,
      entry: bundle.entry.path,
      values: bundle.values.map(block => block.path),
    },
  )
  const expectedModules = registered.modules.map(block => block.path).sort()
  const actualModules = (bundle.modules ?? []).map(block => block.path).sort()
  if (
    expectedModules.length !== actualModules.length ||
    expectedModules.some((path, i) => path !== actualModules[i])
  ) {
    fail("INVALID_BUNDLE", location, "Bundle module dependencies do not match selected imports")
  }
  if (
    (bundle.values.some(block => block.path.endsWith(".py")) &&
      bundle.pythonModules === undefined) ||
    (!bundle.values.some(block => block.path.endsWith(".py")) &&
      (bundle.pythonModules?.length ?? 0) > 0) ||
    (bundle.pythonModules ?? []).some(
      block =>
        !block.path.endsWith(".py") || bundle.values.some(value => value.path === block.path),
    )
  ) {
    fail("INVALID_BUNDLE", location, "Invalid Python module dependency list")
  }
}

export async function runLiterate(bundle, options = {}) {
  validateBundle(bundle)
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    Object.keys(options).some(key => key !== "globals" && key !== "moduleRoot") ||
    (options.moduleRoot !== undefined &&
      (typeof options.moduleRoot !== "string" || options.moduleRoot.length === 0)) ||
    (options.globals !== undefined &&
      (options.globals === null ||
        typeof options.globals !== "object" ||
        Array.isArray(options.globals)))
  ) {
    fail("INVALID_OPTIONS", bundle.entry, "Expected globals to be a plain object")
  }
  let module
  try {
    module = await WebAssembly.compile(Buffer.from(bundle.wasm, "base64"))
  } catch (error) {
    fail("INVALID_BUNDLE", bundle.entry, "Invalid program Wasm", error)
  }
  const expectedImports = new Set([
    "literal",
    "scope",
    "bind",
    "assign",
    "get",
    "array",
    "push",
    "spread",
    "object",
    "property",
    "member",
    "unary",
    "binary",
    "truthy",
    "function",
    "call",
    "node",
    "length",
    "item",
  ])
  if (
    WebAssembly.Module.imports(module).some(
      item =>
        item.module !== "matra" || item.kind !== "function" || !expectedImports.has(item.name),
    ) ||
    ![
      ["memory", "memory"],
      ["run", "function"],
    ].every(([name, kind]) =>
      WebAssembly.Module.exports(module).some(item => item.name === name && item.kind === kind),
    )
  ) {
    fail("INVALID_BUNDLE", bundle.entry, "Unsupported program ABI")
  }
  const context = createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
  })
  const prototypes = new Script(
    "({ object: Object.prototype, array: Array.prototype })",
  ).runInContext(context)
  const globals = Object.create(null)
  const blocks = [...bundle.values].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  for (const block of blocks) {
    if (!block.path.endsWith(".js.part")) continue
    let value
    try {
      value = expression(block).runInContext(context)
    } catch (error) {
      if (error instanceof LiterateError) throw error
      fail("JS_INITIALIZE", block, error?.message ?? String(error), error)
    }
    bindPublicValue(
      globals,
      publicName(block),
      copyValue(value, { block, prototypes, functions: true }),
      block,
    )
  }
  const moduleRoots = blocks.filter(block => block.path.endsWith(".js"))
  const cleanupModules = await loadStandardModules(
    moduleRoots,
    bundle.modules ?? [],
    globals,
    prototypes,
    options.moduleRoot ?? process.cwd(),
  )
  let pythonRuntime
  try {
    const pythonRoots = blocks.filter(block => block.path.endsWith(".py"))
    if (pythonRoots.length) {
      try {
        pythonRuntime = await loadPythonModules(pythonRoots, bundle.pythonModules ?? [])
      } catch (error) {
        if (error instanceof LiterateError) throw error
        const block = error.block ?? pythonRoots[0]
        fail(
          error.code ?? "PY_INITIALIZE",
          { ...block, line: block.line + (error.line ?? 1) - 1 },
          error.message ?? String(error),
          error,
        )
      }
      const availableBlocks = new Map(
        [...bundle.values, ...(bundle.modules ?? []), ...(bundle.pythonModules ?? [])].map(
          block => [block.path, block],
        ),
      )
      publicBindings(bundle.values, availableBlocks, pythonRuntime.exportNames)
      for (const block of pythonRoots) {
        const parts = publicName(block)
        const values = pythonRuntime.exports.get(block.path)
        for (const [name, value] of Object.entries(values)) {
          const exposed = typeof value === "function" ? pythonRuntime.wrapFunction(value) : value
          bindPublicValue(
            globals,
            [...parts, name],
            copyValue(exposed, {
              block,
              prototypes,
              functions: typeof exposed === "function",
              functionResults: false,
            }),
            block,
          )
        }
      }
    }
    const hostGlobals = options.globals ?? {}
    const copiedHostGlobals = copyValue(hostGlobals, {
      block: { document: bundle.entry.document, path: "<globals>", line: 1 },
      prototypes,
      functions: false,
    })
    for (const [name, value] of Object.entries(copiedHostGlobals)) {
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
        fail("INVALID_GLOBALS", bundle.entry, `Invalid global name: ${name}`)
      }
      if (Object.hasOwn(globals, name)) {
        fail("GLOBAL_COLLISION", bundle.entry, `Host global conflicts with a value module: ${name}`)
      }
      globals[name] = value
    }
    try {
      const program = await instantiateMatra(module, { globals })
      const result = program.run()
      return copyValue(result, { block: bundle.entry, prototypes, functions: false })
    } catch (error) {
      if (error instanceof LiterateError) throw error
      fail("MATRA_RUNTIME", bundle.entry, error?.message ?? String(error), error)
    }
  } finally {
    await pythonRuntime?.cleanup()
    await cleanupModules()
  }
}
