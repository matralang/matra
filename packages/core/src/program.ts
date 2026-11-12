import { readJavaScriptBlock } from "./javascript-block.js"
import { parseProgram } from "./program-base.js"

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

export function parse(source: string) {
  return parseProgram(source, readJavaScriptBlock)
}
