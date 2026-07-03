import type { SourcePosition } from "@matra/core"

export class CommandValidationError extends TypeError {
  readonly position?: SourcePosition

  constructor(message: string, position?: SourcePosition) {
    super(message)
    this.name = "CommandValidationError"
    this.position = position
  }
}

export class CommandAuthorizationError extends Error {
  readonly violations: string[]

  constructor(violations: string[]) {
    super(`Command plan is not authorized:\n${violations.map(item => `- ${item}`).join("\n")}`)
    this.name = "CommandAuthorizationError"
    this.violations = violations
  }
}

export class CommandExecutionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "CommandExecutionError"
  }
}
