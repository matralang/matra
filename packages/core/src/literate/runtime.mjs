import { types } from "node:util"
import { createContext, Script } from "node:vm"
import { load as loadYaml } from "js-yaml"
import { LITERATE_ABI, loadCompiler } from "./compiler.mjs"
import { formatCompilerDiagnostic, reserveCompilerWorkspace } from "./compiler-host.mjs"
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
  const names = []
  for (const block of collected) {
    const { path } = block
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
    if (path.endsWith(".js") || path.endsWith(".js.part")) {
      const parts = publicName(block)
      if (parts.some(part => !/^[A-Za-z_$][\w$]*$/.test(part))) {
        fail("INVALID_PATH", block, "Public path components must be identifiers")
      }
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
  const selected = values.map(path => select(path, ".js.part"))
  selected.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  for (const block of selected) expression(block)
  return { entry: main, values: selected }
}

/** @returns {Promise<import("../literate.js").LiterateBundle>} */
export async function buildLiterate(markdown, options = {}) {
  const registration = registerLiterate(markdown, options)
  const { entry } = registration
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
  return { format: "matra-literate-1", abi: LITERATE_ABI, ...registration, wasm }
}

function copyValue(value, { block, prototypes, functions, active = new Set() }) {
  const next = item => copyValue(item, { block, prototypes, functions, active })
  const invalid = message => fail("UNSUPPORTED_VALUE", block, message)
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "function" && functions) {
    return (...args) => {
      try {
        const input = args.map(arg => copyValue(arg, { block, prototypes, functions: false }))
        return next(Reflect.apply(value, undefined, input))
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
    typeof bundle.wasm !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(bundle.wasm)
  ) {
    fail("INVALID_BUNDLE", location, "Invalid or unsupported literate bundle")
  }
  // 保存済みbundleにも登録時と同じ選択・衝突規則を適用する。
  selectBlocks([bundle.entry, ...bundle.values], {
    document: bundle.entry.document,
    entry: bundle.entry.path,
    values: bundle.values.map(block => block.path),
  })
}

export async function runLiterate(bundle) {
  validateBundle(bundle)
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
    let value
    try {
      value = expression(block).runInContext(context)
    } catch (error) {
      if (error instanceof LiterateError) throw error
      fail("JS_INITIALIZE", block, error?.message ?? String(error), error)
    }
    const parts = publicName(block)
    let target = globals
    for (const part of parts.slice(0, -1)) {
      if (!Object.hasOwn(target, part)) target[part] = Object.create(null)
      target = target[part]
    }
    target[parts.at(-1)] = copyValue(value, { block, prototypes, functions: true })
  }
  try {
    const program = await instantiateMatra(module, { globals })
    const result = program.run()
    return copyValue(result, { block: bundle.entry, prototypes, functions: false })
  } catch (error) {
    if (error instanceof LiterateError) throw error
    fail("MATRA_RUNTIME", bundle.entry, error?.message ?? String(error), error)
  }
}
