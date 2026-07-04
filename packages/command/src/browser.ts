import type { MatraAST, MatraPropValue, MatraValue } from "@matra/core"
import { CommandExecutionError, CommandValidationError } from "./errors.js"
import type { CommandOutputFormat } from "./types.js"

const OUTPUT_FORMATS = new Set<CommandOutputFormat>(["text", "json", "ndjson", "binary"])
const BROWSER_PROPS = new Set(["id", "stdin", "stdout", "timeout", "bind"])

export interface BrowserNodejsBlock {
  code: string
  stdin?: MatraValue
  stdout: CommandOutputFormat
  timeout: number
  bind?: string
}

export interface BrowserNodejsResult {
  status: "ok"
  value: MatraValue | Uint8Array
  durationMs: number
  bind?: string
}

export interface BrowserExecuteOptions {
  timeout?: number
  signal?: AbortSignal
}

/** Validate a nodejs AST without importing any Node-only runtime modules. */
export function prepareNodejsBlock(
  ast: MatraAST,
  options: BrowserExecuteOptions = {},
): BrowserNodejsBlock {
  if (ast.tag !== "nodejs") throw new CommandValidationError("Browser execution expects a nodejs block", ast.position)
  if (ast.children.length !== 1 || typeof ast.children[0] !== "string") {
    throw new CommandValidationError("nodejs expects exactly one text code block", ast.position)
  }
  for (const key of Object.keys(ast.props)) {
    if (!BROWSER_PROPS.has(key)) throw new CommandValidationError(`Unsupported browser nodejs prop: ${key}`, ast.position)
  }
  const stdout = optionalString(ast.props.stdout, "stdout", ast) ?? "json"
  if (!OUTPUT_FORMATS.has(stdout as CommandOutputFormat)) {
    throw new CommandValidationError(`nodejs stdout must be one of: ${[...OUTPUT_FORMATS].join(", ")}`, ast.position)
  }
  const timeout = options.timeout ?? optionalNumber(ast.props.timeout, "timeout", ast) ?? 3000
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new CommandValidationError("nodejs timeout must be a positive finite number", ast.position)
  }
  const stdin = plainValue(ast.props.stdin, "stdin", ast)
  const bind = optionalString(ast.props.bind, "bind", ast)
  return {
    code: ast.children[0],
    stdout: stdout as CommandOutputFormat,
    timeout,
    ...(stdin === undefined ? {} : { stdin }),
    ...(bind === undefined ? {} : { bind }),
  }
}

/** Execute one nodejs block in a disposable Web Worker. */
export function executeNodejsBlock(
  ast: MatraAST,
  options: BrowserExecuteOptions = {},
): Promise<BrowserNodejsResult> {
  const block = prepareNodejsBlock(ast, options)
  if (typeof Worker === "undefined" || typeof Blob === "undefined") {
    return Promise.reject(new CommandExecutionError("Web Worker execution is not available"))
  }
  const started = performance.now()
  const source = browserWorkerSource(block.code, block.stdout)
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }))

  return new Promise((resolve, reject) => {
    const worker = new Worker(url)
    let settled = false
    const cleanup = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener("abort", abort)
      worker.terminate()
      URL.revokeObjectURL(url)
    }
    const fail = (message: string): void => {
      cleanup()
      reject(new CommandExecutionError(message))
    }
    const abort = (): void => fail("Browser nodejs execution aborted")
    const timer = setTimeout(() => fail(`Browser nodejs block timed out after ${block.timeout}ms`), block.timeout)
    options.signal?.addEventListener("abort", abort, { once: true })

    worker.onmessage = event => {
      const message = event.data as { type?: unknown; value?: unknown; error?: unknown }
      if (message?.type === "error") {
        fail(String(message.error ?? "Browser nodejs block failed"))
        return
      }
      if (message?.type !== "result") return
      try {
        const value = message.value instanceof Uint8Array
          ? message.value
          : requireMatraValue(message.value)
        cleanup()
        resolve({
          status: "ok",
          value,
          durationMs: Math.max(0, performance.now() - started),
          ...(block.bind ? { bind: block.bind } : {}),
        })
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error))
      }
    }
    worker.onerror = event => fail(event.message || "Browser nodejs worker failed")
    if (options.signal?.aborted) abort()
    else worker.postMessage(block.stdin ?? null)
  })
}

/** Worker source is exported for CSP adapters and deterministic testing. */
export function browserWorkerSource(code: string, format: CommandOutputFormat = "json"): string {
  return `"use strict";
self.fetch = undefined;
self.XMLHttpRequest = undefined;
self.WebSocket = undefined;
self.EventSource = undefined;
self.onmessage = async event => {
  const input = event.data;
  const __format = ${JSON.stringify(format)};
  const __values = [];
  const emit = value => __values.push(value);
  try {
    const __returned = await (async () => {
${code}
    })();
    if (__returned !== undefined && __values.length === 0) __values.push(__returned);
    let __output;
    if (__format === "ndjson") __output = __values;
    else if (__format === "text") __output = __values.map(value => typeof value === "string" ? value : String(value)).join("");
    else if (__format === "binary") __output = __values[0] instanceof Uint8Array ? __values[0] : new TextEncoder().encode(String(__values[0] ?? ""));
    else __output = __values.length <= 1 ? (__values[0] ?? null) : __values;
    self.postMessage({ type: "result", value: __output });
  } catch (error) {
    self.postMessage({ type: "error", error: error?.stack ?? error?.message ?? String(error) });
  }
};`
}

function optionalString(value: MatraPropValue | undefined, key: string, ast: MatraAST): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "string") throw new CommandValidationError(`nodejs ${key} must be a string`, ast.position)
  return value
}

function optionalNumber(value: MatraPropValue | undefined, key: string, ast: MatraAST): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "number") throw new CommandValidationError(`nodejs ${key} must be a number`, ast.position)
  return value
}

function plainValue(value: MatraPropValue | undefined, key: string, ast: MatraAST): MatraValue | undefined {
  if (value === undefined) return undefined
  if (isAst(value)) throw new CommandValidationError(`nodejs ${key} must be evaluated before execution`, ast.position)
  return value
}

function isAst(value: MatraPropValue): value is MatraAST {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    "tag" in value && "props" in value && "children" in value
}

function requireMatraValue(value: unknown): MatraValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(requireMatraValue)
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, requireMatraValue(item)]))
  }
  throw new TypeError("Browser nodejs output must be JSON-compatible")
}
