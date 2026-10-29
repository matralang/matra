/** Browser-safe document parsing and evaluation entry point. */

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
} from "./program.js"
export {
  EvaluationRequiredError,
  evaluate,
  evaluateStatic,
  ProgramSyntaxError,
  parse,
  staticValueToAST,
} from "./program.js"
