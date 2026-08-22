type RawMatraSource = { readonly kind: "RawMatraSource", readonly source: string }

/** Execute a trusted .matra.ts program and return its generated Matra source. */
export function executeMatraProgram(program: string): string {
  const javaScript = compileMatraBlock(program)
  // Website page sources are repository-owned build inputs, not user input.
  // eslint-disable-next-line no-new-func
  const execute = new Function("m", "raw", `"use strict";\n${javaScript}`) as (
    m: (strings: TemplateStringsArray, ...values: unknown[]) => string,
    raw: (source: string) => RawMatraSource,
  ) => unknown
  const result = execute(matraTemplate, rawMatra)
  if (typeof result !== "string") {
    throw new TypeError("A .matra.ts page must produce Matra source.")
  }
  return result
}

function matraTemplate(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((result, chunk, index) =>
    result + chunk + (index < values.length ? matraSourceValue(values[index]) : ""),
  "")
}

function matraSourceValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (isRawMatraSource(value)) return value.source
  if (typeof value === "string") return JSON.stringify(value)
  if (Array.isArray(value)) return value.map(matraSourceValue).join("\n")
  if (typeof value === "function") throw new TypeError("Functions cannot be interpolated into Matra source.")
  return String(value)
}

function rawMatra(source: string): RawMatraSource {
  return { kind: "RawMatraSource", source }
}

function isRawMatraSource(value: unknown): value is RawMatraSource {
  return typeof value === "object" && value !== null &&
    "kind" in value && value.kind === "RawMatraSource" &&
    "source" in value && typeof value.source === "string"
}

function compileMatraBlock(program: string): string {
  const match = /\b(?:return\s+)?matra\s*\{/.exec(program)
  if (!match || match.index === undefined) {
    throw new SyntaxError("A .matra.ts page must end with a `matra { ... }` block.")
  }
  const open = match.index + match[0].lastIndexOf("{")
  const close = matchingBrace(program, open)
  if (!/^[;\s]*$/.test(program.slice(close + 1))) {
    throw new SyntaxError("The `matra { ... }` block must be the final expression in a .matra.ts page.")
  }
  const source = program.slice(open + 1, close)
  if (source.includes("`")) throw new SyntaxError("Backtick text is not supported in a .matra.ts page.")
  return `${program.slice(0, match.index)}return m\`${escapeTemplateSyntaxInStrings(source)}\`${program.slice(close + 1)}`
}

function escapeTemplateSyntaxInStrings(source: string): string {
  let result = ""
  let quote = false
  let escaped = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote && character === "$" && source[index + 1] === "{") result += "\\"
    result += character
    if (!quote) {
      quote = character === '"'
      continue
    }
    if (escaped) escaped = false
    else if (character === "\\") escaped = true
    else if (character === '"') quote = false
  }
  return result
}

function matchingBrace(source: string, open: number): number {
  let depth = 0
  let quote = ""
  let escaped = false
  for (let index = open; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === quote) quote = ""
      continue
    }
    if (character === '"' || character === "'") { quote = character; continue }
    if (character === "{") depth += 1
    if (character === "}") {
      depth -= 1
      if (depth === 0) return index
    }
  }
  throw new SyntaxError("Unclosed Matra block.")
}
