import type { SourcePosition } from "../ast/types.js"

export class MatraSyntaxError extends SyntaxError {
  readonly location: SourcePosition
  readonly codeFrame: string
  override readonly cause: unknown

  constructor(
    message: string,
    location: SourcePosition,
    source: string,
    cause?: unknown,
  ) {
    const codeFrame = formatCodeFrame(source, location)
    const where = location.source
      ? `${location.source}:${location.start.line}:${location.start.column}`
      : `line ${location.start.line}, column ${location.start.column}`
    super(`${message} at ${where}${codeFrame ? `\n${codeFrame}` : ""}`)
    this.name = "MatraSyntaxError"
    this.location = location
    this.codeFrame = codeFrame
    this.cause = cause
  }
}

export function normalizeSyntaxError(
  error: unknown,
  source: string,
  sourceId?: string,
): Error {
  if (error instanceof MatraSyntaxError) return error
  const location = readLocation(error, sourceId)
  if (!location) return error instanceof Error ? error : new Error(String(error))
  const message = error instanceof Error ? error.message : String(error)
  return new MatraSyntaxError(message, location, source, error)
}

export function formatCodeFrame(source: string, position: SourcePosition): string {
  const lines = source.split(/\r?\n/)
  const lineIndex = position.start.line - 1
  const line = lines[lineIndex]
  if (line === undefined) return ""
  const number = String(position.start.line)
  const startColumn = Math.max(1, position.start.column)
  const sameLine = position.end.line === position.start.line
  const width = sameLine
    ? Math.max(1, position.end.column - startColumn)
    : Math.max(1, line.length - startColumn + 2)
  return `${number} | ${line}\n${" ".repeat(number.length)} | ${" ".repeat(startColumn - 1)}${"^".repeat(width)}`
}

function readLocation(error: unknown, sourceId?: string): SourcePosition | null {
  if (typeof error !== "object" || error === null || !("location" in error)) return null
  const value = error.location
  if (typeof value !== "object" || value === null || !("start" in value) || !("end" in value)) return null
  if (!isPoint(value.start) || !isPoint(value.end)) return null
  return {
    start: value.start,
    end: value.end,
    ...(sourceId ? { source: sourceId } : {}),
  }
}

function isPoint(value: unknown): value is SourcePosition["start"] {
  return typeof value === "object" && value !== null &&
    "offset" in value && typeof value.offset === "number" &&
    "line" in value && typeof value.line === "number" &&
    "column" in value && typeof value.column === "number"
}
