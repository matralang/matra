import type { MatraValue, SourcePosition } from "@matra/core"

export type CommandOutputFormat = "text" | "json" | "ndjson" | "binary"
export type CommandStderrMode = "text" | "ignore"

export interface CommandCapabilities {
  commands: string[]
  read: string[]
  write: string[]
  network: boolean
}

export interface CommandSpec {
  id: string
  program: string
  args: string[]
  cwd?: string
  env: Record<string, string>
  stdin?: MatraValue
  stdout: CommandOutputFormat
  stderr: CommandStderrMode
  timeout?: number
  allowFail: boolean
  bind?: string
  requires: string[]
  produces: string[]
  capabilities: CommandCapabilities
  position?: SourcePosition
}

export interface ExecutionPlan {
  version: 1
  commands: CommandSpec[]
  capabilities: CommandCapabilities
}

export interface CapabilityPolicy {
  commands?: readonly string[] | "*"
  read?: readonly string[] | "*"
  write?: readonly string[] | "*"
  network?: boolean
}

export interface AuthorizedExecutionPlan extends ExecutionPlan {
  authorization: {
    authorized: true
    policy: CapabilityPolicy
  }
}

export type CommandStatus = "ok" | "error" | "skipped"

export interface CommandResult {
  id: string
  status: CommandStatus
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: MatraValue | Uint8Array
  stderr: string
  durationMs: number
  error?: string
}

export interface ExecutionResult {
  status: "ok" | "error"
  results: CommandResult[]
  bindings: Record<string, MatraValue | Uint8Array>
}

export interface CommandEvent {
  type: "start" | "finish"
  command: CommandSpec
  result?: CommandResult
}

export interface ExecuteOptions {
  signal?: AbortSignal
  maxOutputBytes?: number
  onEvent?: (event: CommandEvent) => void
}
