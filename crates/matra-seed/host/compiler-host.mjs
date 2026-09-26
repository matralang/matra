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
  return { line: lines.length, column: displayWidth(lines.at(-1)) + 1 }
}

export function sourceExcerpt(source, offset, length) {
  let lineStart = offset
  while (lineStart > 0 && source[lineStart - 1] !== 10) lineStart -= 1
  let lineEnd = offset
  while (lineEnd < source.length && source[lineEnd] !== 10) lineEnd += 1

  const decoder = new TextDecoder()
  const linePrefix = decoder.decode(source.slice(lineStart, offset))
  const line = decoder.decode(source.slice(lineStart, lineEnd))
  const rangeEnd = Math.min(offset + length, lineEnd)
  const range = decoder.decode(source.slice(offset, rangeEnd))
  const position = sourcePosition(source, offset)
  const prefixWidth = displayWidth(linePrefix)
  return {
    ...position,
    excerpt: expandTabs(line),
    underline: `${" ".repeat(prefixWidth)}${"^".repeat(Math.max(1, displayWidth(range, prefixWidth) - prefixWidth))}`,
  }
}

export function formatCompilerDiagnostic(source, memory, recordPointer, fileName) {
  const record = new DataView(memory.buffer, recordPointer, 36)
  const code = record.getInt32(20, true)
  const offset = record.getInt32(24, true)
  const length = record.getInt32(28, true)
  const expected = record.getInt32(32, true)
  const excerpt = sourceExcerpt(source, offset, length)
  const label = diagnosticLabels[code] ?? "compiler error"
  const expectedLabel = expectedLabels[expected]
  const expectation = code === 1 && expectedLabel ? `: expected ${expectedLabel}` : ""
  const location = fileName ? `${fileName}:${excerpt.line}:${excerpt.column}: ` : ""
  const position = fileName ? "" : ` at ${excerpt.line}:${excerpt.column}`
  return `${location}${label}${expectation}${position}\n${excerpt.excerpt}\n${excerpt.underline}`
}

function displayWidth(value, initialWidth = 0) {
  let width = initialWidth
  for (const character of value) {
    width = character === "\t" ? width + 4 - (width % 4) : width + 1
  }
  return width
}

function expandTabs(value) {
  let result = ""
  let width = 0
  for (const character of value) {
    if (character === "\t") {
      const spaces = 4 - (width % 4)
      result += " ".repeat(spaces)
      width += spaces
    } else {
      result += character
      width += 1
    }
  }
  return result
}
// 文書 frontend の arena/buffer を含め、compiler 自身が示す作業量を確保する。
export function reserveCompilerWorkspace(compiler, sourcePointer, sourceLength) {
  const pages = typeof compiler.workspace_pages === "function"
    ? compiler.workspace_pages(sourcePointer, sourceLength)
    : Math.ceil(sourceLength * 4 / 65536) + 128
  if (!Number.isInteger(pages) || pages <= 0) throw new RangeError("Compiler workspace size is out of range")
  compiler.memory.grow(pages)
}
