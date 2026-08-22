import { matra } from "@matra/core"

/** Execute a .matra.ts module and return its generated Matra source. */
export function executeMatraProgram(program: string): string {
  const javaScript = compileMatraModule(program)
  // .matra.ts is explicitly executable code, both in the build and Playground.
  // eslint-disable-next-line no-new-func
  const execute = new Function("matra", `"use strict";\n${javaScript}`) as (matra: typeof matra) => unknown
  const result = execute(matra)
  if (typeof result !== "string") {
    throw new TypeError("A .matra.ts page must produce Matra source.")
  }
  return result
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
