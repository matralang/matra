import {
  evaluate as computeEvaluate,
  simplify as computeSimplify,
  N,
} from "@cortex-js/compute-engine"
import { evaluatePropExpressions, type MatraAST, type MatraValue } from "@matra/core"
import {
  astToMathJson,
  contentMathMLToMathJson,
  type MathJson,
  type MorphionForm,
  mathJsonToContentMathML,
  parseContentMathML,
  parseMath,
} from "@matra/math"
import { morphionize } from "./morphion.js"
import { listStandardMathCommands } from "./standard-library.js"

export type MathScope = Readonly<Record<string, MathJson>>
export type { MathCommandInfo } from "./standard-library.js"
export type { MorphionForm }
export { listStandardMathCommands, morphionize }

const NON_FINITE_MATH_VALUES = new Set(["ComplexInfinity", "NaN", "NegativeInfinity"])

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

/** Evaluate supported Content MathML and return a CD-aware semantic expression. */
export function evaluateContentMathML(source: string) {
  const expression = contentMathMLToMathJson(parseContentMathML(source))
  const result = evaluate(expression) as MathJson
  if (isNonFiniteMathValue(result)) {
    throw new RangeError(`Content MathML evaluation produced a non-finite value: ${result}`)
  }
  return mathJsonToContentMathML(result)
}

/**
 * Evaluate math expressions embedded in props throughout an AST.
 * Exact finite numbers and rationals are preferred; other expressions fall
 * back to numeric approximation.
 */
export function numericEvaluateProps(ast: MatraAST, scope: MathScope = {}): MatraAST {
  return evaluatePropExpressions(ast, expression => {
    const bound = bind(astToMathJson(expression), scope)
    const exact = exactScalarNumber(evaluate(bound))
    return exact ?? requireMatraValue(numericEvaluate(bound))
  })
}

/** Replace symbol operands with MathJSON values before computation. */
function bind(expression: MathJson, scope: MathScope): MathJson {
  if (typeof expression === "string") {
    return Object.hasOwn(scope, expression) ? scope[expression] : expression
  }
  if (!Array.isArray(expression)) return expression
  const [head, ...operands] = expression
  return [head, ...operands.map(operand => bind(operand, scope))]
}

function requireMatraValue(value: unknown): MatraValue {
  if (value === null || typeof value === "boolean") return value
  if (isNonFiniteMathValue(value)) throw new TypeError("Computed prop value must be finite")
  if (typeof value === "string") return value
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

function isNonFiniteMathValue(value: unknown): value is string {
  return typeof value === "string" && NON_FINITE_MATH_VALUES.has(value)
}

function exactScalarNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value[0] === "Rational" &&
    typeof value[1] === "number" &&
    typeof value[2] === "number" &&
    Number.isFinite(value[1]) &&
    Number.isFinite(value[2]) &&
    value[2] !== 0
  ) {
    const quotient = value[1] / value[2]
    return Number.isFinite(quotient) ? quotient : undefined
  }
  return undefined
}
