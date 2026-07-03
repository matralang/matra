import { spawn } from "node:child_process"
import { performance } from "node:perf_hooks"
import { CommandExecutionError } from "./errors.js"
import type {
  AuthorizedExecutionPlan,
  CommandOutputFormat,
  CommandResult,
  CommandSpec,
  ExecuteOptions,
  ExecutionResult,
} from "./types.js"
import type { MatraValue } from "@matra/core"

const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024

/** Execute an explicitly authorized plan using shell-free local processes. */
export async function executePlan(
  plan: AuthorizedExecutionPlan,
  options: ExecuteOptions = {},
): Promise<ExecutionResult> {
  if (plan.authorization?.authorized !== true) {
    throw new CommandExecutionError("Execution plan must be authorized before execution")
  }
  const results: CommandResult[] = []
  const byName = new Map<string, CommandResult>()
  const bindings: Record<string, MatraValue | Uint8Array> = {}

  for (const command of plan.commands) {
    const failedDependency = command.requires.find(name => byName.get(name)?.status !== "ok")
    if (failedDependency) {
      const result: CommandResult = {
        id: command.id,
        status: "skipped",
        exitCode: null,
        signal: null,
        stdout: "",
        stderr: "",
        durationMs: 0,
        error: `Dependency did not succeed: ${failedDependency}`,
      }
      record(command, result, results, byName)
      continue
    }

    const stdin = resolveStdin(command.stdin, bindings)
    options.onEvent?.({ type: "start", command })
    const result = await executeCommand(command, stdin, options)
    options.onEvent?.({ type: "finish", command, result })
    record(command, result, results, byName)
    if (command.bind && result.status === "ok") bindings[command.bind] = result.stdout
  }

  return {
    status: results.every(result => result.status === "ok") ? "ok" : "error",
    results,
    bindings,
  }
}

async function executeCommand(
  command: CommandSpec,
  stdin: MatraValue | Uint8Array | undefined,
  options: ExecuteOptions,
): Promise<CommandResult> {
  const started = performance.now()
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    throw new RangeError("maxOutputBytes must be a positive safe integer")
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command.program, command.args, {
      cwd: command.cwd,
      env: { ...process.env, ...command.env },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    })
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let outputBytes = 0
    let settled = false
    let terminationError: string | undefined

    const finishError = (error: unknown): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(new CommandExecutionError(`Failed to execute ${command.id}: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      }))
    }
    const collect = (target: Buffer[], chunk: Buffer): void => {
      outputBytes += chunk.length
      if (outputBytes > maxOutputBytes) {
        terminationError = `Combined output exceeded ${maxOutputBytes} bytes`
        child.kill("SIGTERM")
        return
      }
      target.push(chunk)
    }
    child.stdout.on("data", (chunk: Buffer) => collect(stdoutChunks, chunk))
    child.stderr.on("data", (chunk: Buffer) => {
      if (command.stderr === "text") collect(stderrChunks, chunk)
    })
    child.on("error", finishError)

    const abort = (): void => {
      terminationError = "Execution aborted"
      child.kill("SIGTERM")
    }
    options.signal?.addEventListener("abort", abort, { once: true })
    if (options.signal?.aborted) abort()

    const timer = command.timeout === undefined ? undefined : setTimeout(() => {
      terminationError = `Command timed out after ${command.timeout}ms`
      child.kill("SIGTERM")
    }, command.timeout)

    const cleanup = (): void => {
      if (timer !== undefined) clearTimeout(timer)
      options.signal?.removeEventListener("abort", abort)
    }

    child.on("close", (exitCode, signal) => {
      if (settled) return
      settled = true
      cleanup()
      const stderr = Buffer.concat(stderrChunks).toString("utf8")
      const rawStdout = Buffer.concat(stdoutChunks)
      let stdout: MatraValue | Uint8Array = ""
      let decodeError: string | undefined
      try {
        stdout = decodeOutput(rawStdout, command.stdout)
      } catch (error) {
        decodeError = error instanceof Error ? error.message : String(error)
      }
      const processFailed = exitCode !== 0 && !command.allowFail
      const error = terminationError ?? decodeError ?? (processFailed ? `Process exited with code ${exitCode}` : undefined)
      resolve({
        id: command.id,
        status: error ? "error" : "ok",
        exitCode,
        signal,
        stdout,
        stderr,
        durationMs: Math.max(0, performance.now() - started),
        ...(error ? { error } : {}),
      })
    })

    try {
      if (stdin !== undefined) child.stdin.end(encodeInput(stdin))
      else child.stdin.end()
    } catch (error) {
      finishError(error)
    }
  })
}

function resolveStdin(
  stdin: MatraValue | undefined,
  bindings: Record<string, MatraValue | Uint8Array>,
): MatraValue | Uint8Array | undefined {
  if (isRef(stdin)) {
    if (!Object.prototype.hasOwnProperty.call(bindings, stdin.ref)) {
      throw new CommandExecutionError(`Unknown stdin binding: ${stdin.ref}`)
    }
    return bindings[stdin.ref]
  }
  return stdin
}

function isRef(value: MatraValue | undefined): value is { ref: string } {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.keys(value).length === 1 && typeof value.ref === "string"
}

function encodeInput(value: MatraValue | Uint8Array): string | Uint8Array {
  if (value instanceof Uint8Array) return value
  return typeof value === "string" ? value : JSON.stringify(value)
}

function decodeOutput(buffer: Buffer, format: CommandOutputFormat): MatraValue | Uint8Array {
  if (format === "binary") return new Uint8Array(buffer)
  const text = buffer.toString("utf8")
  if (format === "text") return text
  if (format === "json") return requireMatraValue(JSON.parse(text))
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
  return lines.map((line, index) => {
    try {
      return requireMatraValue(JSON.parse(line))
    } catch (error) {
      throw new SyntaxError(`Invalid NDJSON on line ${index + 1}`, { cause: error })
    }
  })
}

function requireMatraValue(value: unknown): MatraValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(requireMatraValue)
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, requireMatraValue(item)]))
  }
  throw new TypeError("Command output must be JSON-compatible")
}

function record(
  command: CommandSpec,
  result: CommandResult,
  results: CommandResult[],
  byName: Map<string, CommandResult>,
): void {
  results.push(result)
  byName.set(command.id, result)
  if (command.bind) byName.set(command.bind, result)
}
