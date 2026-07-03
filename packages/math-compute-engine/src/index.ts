import { evaluate as computeEvaluate, N, simplify as computeSimplify } from "@cortex-js/compute-engine"
import { evaluatePropExpressions, type MatraAST, type MatraValue } from "@matra/core"
import { astToMathJson, parseMath, type MathJson } from "@matra/math"

export type MathScope = Readonly<Record<string, MathJson>>

/** Evaluate an already parsed MathJSON expression. */
export function evaluate(expression: MathJson): unknown {
  return computeEvaluate(expression as never).toMathJson()
}

/** Symbolically simplify an already parsed MathJSON expression. */
export function simplify(expression: MathJson): unknown {
  return computeSimplify(expression as never).toMathJson()
}

/** Numerically approximate an already parsed MathJSON expression. */
export function numericEvaluate(expression: MathJson): unknown {
  return N(expression as never).toMathJson()
}

/** Parse Matra syntax and evaluate it with Cortex Compute Engine. */
export function evaluateMatra(source: string, scope: MathScope = {}): unknown {
  return evaluate(bind(parseMath(source), scope))
}

/** Parse Matra syntax and symbolically simplify it. */
export function simplifyMatra(source: string, scope: MathScope = {}): unknown {
  return simplify(bind(parseMath(source), scope))
}

/** Parse Matra syntax and numerically approximate it. */
export function numericEvaluateMatra(source: string, scope: MathScope = {}): unknown {
  return numericEvaluate(bind(parseMath(source), scope))
}

/** Numerically evaluate math expressions embedded in props throughout an AST. */
export function numericEvaluateProps(ast: MatraAST, scope: MathScope = {}): MatraAST {
  return evaluatePropExpressions(ast, expression =>
    requireMatraValue(numericEvaluate(bind(astToMathJson(expression), scope))),
  )
}

/** Replace symbol operands with MathJSON values before computation. */
function bind(expression: MathJson, scope: MathScope): MathJson {
  if (typeof expression === "string") {
    return Object.prototype.hasOwnProperty.call(scope, expression) ? scope[expression] : expression
  }
  if (!Array.isArray(expression)) return expression
  const [head, ...operands] = expression
  return [head, ...operands.map((operand) => bind(operand, scope))]
}

function requireMatraValue(value: unknown): MatraValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Computed prop value must be finite")
    return value
  }
  if (Array.isArray(value)) return value.map(requireMatraValue)
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, requireMatraValue(item)]),
    )
  }
  throw new TypeError("Computed prop value must be JSON-compatible")
}
