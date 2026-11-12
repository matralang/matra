import { tokenizer as createJavaScriptTokenizer } from "acorn"
import { ProgramSyntaxError } from "./program-base.js"

export function readJavaScriptBlock(source: string, start: number): { code: string; end: number } {
  const tokenizer = createJavaScriptTokenizer(source.slice(start), { ecmaVersion: "latest" })
  let depth = 0
  while (true) {
    let token: ReturnType<typeof tokenizer.getToken>
    try {
      token = tokenizer.getToken()
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      const offset = start + ("pos" in error ? Number(error.pos) : 0)
      throw new ProgramSyntaxError(`Invalid JavaScript code block at offset ${offset}.`)
    }
    if (token.type.label === "eof") {
      throw new ProgramSyntaxError(`Unterminated JavaScript code block at offset ${source.length}.`)
    }
    if (token.type.label === "{" || token.type.label === "${") {
      depth++
    } else if (token.type.label === "}") {
      if (depth === 0) {
        const end = start + token.start
        return { code: source.slice(start, end), end }
      }
      depth--
    }
  }
}
