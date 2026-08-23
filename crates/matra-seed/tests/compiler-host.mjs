const diagnosticLabels = ["", "parse error", "unknown function", "argument count mismatch"]

const expectedLabels = [
  "",
  "module",
  "identifier",
  "fn",
  "(",
  "parameter or )",
  ":",
  "i32",
  "-",
  ">",
  "{",
  "return",
  "value",
  "integer",
  ")",
  "}",
]

export function sourcePosition(source, offset) {
  const prefix = new TextDecoder().decode(source.slice(0, offset))
  const lines = prefix.split("\n")
  return { line: lines.length, column: Array.from(lines.at(-1)).length + 1 }
}

export function formatCompilerDiagnostic(source, memory, recordPointer) {
  const record = new DataView(memory.buffer, recordPointer, 36)
  const code = record.getInt32(20, true)
  const offset = record.getInt32(24, true)
  const expected = record.getInt32(32, true)
  const position = sourcePosition(source, offset)
  const label = diagnosticLabels[code] ?? "compiler error"
  const expectedLabel = expectedLabels[expected]
  const expectation = code === 1 && expectedLabel ? `: expected ${expectedLabel}` : ""
  return `${label}${expectation} at ${position.line}:${position.column}`
}