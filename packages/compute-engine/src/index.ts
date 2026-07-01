import { evaluate as computeEvaluate, N, simplify as computeSimplify } from "@cortex-js/compute-engine"
import { parseMath, type MathJson } from "@matra/math"

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
export function evaluateMatra(source: string): unknown {
  return evaluate(parseMath(source))
}

/** Parse Matra syntax and symbolically simplify it. */
export function simplifyMatra(source: string): unknown {
  return simplify(parseMath(source))
}

/** Parse Matra syntax and numerically approximate it. */
export function numericEvaluateMatra(source: string): unknown {
  return numericEvaluate(parseMath(source))
}
