/** Browser entry point that loads the JavaScript tokenizer only when needed. */

export { astToMatraJSON, isMatraAST, isMatraJSON, matraJSONToAST } from "./ast/convert.js"
export type { MatraAST, MatraASTChild, MatraProps, MatraValue } from "./ast/types.js"
export { formatCodeFrame, MatraSyntaxError } from "./parser/error.js"
export type {
  MatraExpression,
  MatraModule,
  MatraStatement,
  StaticNode,
  StaticToASTNode,
  StaticValue,
} from "./program-base.js"
export {
  EvaluationRequiredError,
  evaluate,
  evaluateStatic,
  ProgramSyntaxError,
  staticValueToAST,
} from "./program-base.js"

import { parseProgram } from "./program-base.js"

class JavaScriptTokenizerNeeded extends Error {}

export async function parse(source: string) {
  try {
    return parseProgram(source, () => {
      throw new JavaScriptTokenizerNeeded()
    })
  } catch (error) {
    if (!(error instanceof JavaScriptTokenizerNeeded)) throw error
  }
  const { readJavaScriptBlock } = await import("./javascript-block.js")
  return parseProgram(source, readJavaScriptBlock)
}
