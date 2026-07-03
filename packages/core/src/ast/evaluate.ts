import { isMatraAST } from "./convert.js"
import type { MatraAST, MatraPropValue, MatraValue } from "./types.js"

export type PropExpressionEvaluator = (expression: MatraAST) => MatraValue

/**
 * Immutably evaluate AST expressions stored in props throughout a Matra tree.
 * Child nodes are traversed; expression internals are delegated to evaluator.
 */
export function evaluatePropExpressions(
  ast: MatraAST,
  evaluator: PropExpressionEvaluator,
): MatraAST {
  return {
    ...ast,
    props: Object.fromEntries(
      Object.entries(ast.props).map(([key, value]) => [
        key,
        evaluateProp(value, evaluator),
      ]),
    ),
    children: ast.children.map(child =>
      isMatraAST(child) ? evaluatePropExpressions(child, evaluator) : child,
    ),
  }
}

function evaluateProp(
  value: MatraPropValue,
  evaluator: PropExpressionEvaluator,
): MatraPropValue {
  return isMatraAST(value) ? evaluator(value) : value
}
