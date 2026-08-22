type RawMatraSource = { readonly kind: "RawMatraSource", readonly source: string }

/** Execute a .matra.ts module and return its generated Matra source. */
export function executeMatraProgram(program: string): string {
  const javaScript = compileMatraModule(program)
  // .matra.ts is explicitly executable code, both in the build and Playground.
  // eslint-disable-next-line no-new-func
  const execute = new Function("matra", "raw", `"use strict";\n${javaScript}`) as (
    matra: (strings: TemplateStringsArray, ...values: unknown[]) => string,
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

function compileMatraModule(program: string): string {
  const match = /\bexport\s+default\s+matra\s*`/.exec(program)
  if (!match || match.index === undefined) {
    throw new SyntaxError("A .matra.ts page must end with `export default matra` followed by a template literal.")
  }
  const template = match.index + match[0].lastIndexOf("`")
  const close = matchingTemplateLiteral(program, template)
  if (!/^[;\s]*$/.test(program.slice(close + 1))) {
    throw new SyntaxError("The default Matra template must be the final expression in a .matra.ts page.")
  }
  return `${program.slice(0, match.index)}return matra${program.slice(template, close + 1)}${program.slice(close + 1)}`
}

function matchingTemplateLiteral(source: string, open: number): number {
  let interpolationDepth = 0
  let escaped = false
  for (let index = open + 1; index < source.length; index += 1) {
    const character = source[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (character === "\\") {
      escaped = true
      continue
    }
    if (character === "`" && interpolationDepth === 0) return index
    if (character === "$" && source[index + 1] === "{") {
      interpolationDepth += 1
      index += 1
      continue
    }
    if (character === "}" && interpolationDepth > 0) interpolationDepth -= 1
  }
  throw new SyntaxError("Unclosed Matra template literal.")
}
