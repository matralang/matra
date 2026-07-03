import { isMatraAST } from "./ast/convert.js"
import type { MatraAST, MatraASTChild, MatraValue } from "./ast/types.js"

export type StandardFunction = (
  ...args: MatraValue[]
) => MatraValue

export interface StandardEvaluationOptions {
  /** Application functions available to Map and ordinary calls. */
  functions?: Readonly<Record<string, StandardFunction>>
}

/** Wolfram-style inclusive Range. */
export function Range(end: number): number[]
export function Range(start: number, end: number): number[]
export function Range(start: number, end: number, step: number): number[]
export function Range(startOrEnd: number, end?: number, step?: number): number[] {
  const start = end === undefined ? 1 : startOrEnd
  const stop = end === undefined ? startOrEnd : end
  const increment = step ?? 1

  for (const [name, value] of [["start", start], ["end", stop], ["step", increment]] as const) {
    if (!Number.isFinite(value)) throw new RangeError(`Range ${name} must be finite`)
  }
  if (increment === 0) throw new RangeError("Range step must not be zero")
  if ((increment > 0 && start > stop) || (increment < 0 && start < stop)) return []

  const count = Math.floor((stop - start) / increment + rangeTolerance(start, stop, increment)) + 1
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("Range produces too many values")
  }
  return Array.from({ length: count }, (_, index) => normalizeZero(start + index * increment))
}

/** Apply a standard function to every value in a collection. */
export function Map(
  fn: StandardFunction,
  values: readonly MatraValue[],
): MatraValue[] {
  return values.map(value => fn(value))
}

/** Evaluate Range, Map, and registered application functions in a Core AST. */
export function evaluateStandard(
  expression: MatraAST | MatraASTChild,
  options: StandardEvaluationOptions = {},
): MatraValue {
  return evaluateExpression(expression, options.functions ?? {})
}

function evaluateExpression(
  expression: MatraASTChild,
  functions: Readonly<Record<string, StandardFunction>>,
): MatraValue {
  if (!isMatraAST(expression)) return expression
  if (Object.keys(expression.props).length > 0) {
    throw new TypeError(`Standard function ${expression.tag} does not accept properties`)
  }

  if (expression.tag === "Range") {
    const args = expression.children.map(child => requireNumber(evaluateExpression(child, functions), "Range"))
    if (args.length < 1 || args.length > 3) throw new TypeError("Range expects 1 to 3 arguments")
    return args.length === 1
      ? Range(args[0])
      : args.length === 2
        ? Range(args[0], args[1])
        : Range(args[0], args[1], args[2])
  }

  if (expression.tag === "Map") {
    if (expression.children.length !== 2) throw new TypeError("Map expects 2 arguments")
    const fn = resolveFunction(expression.children[0], functions)
    const values = evaluateExpression(expression.children[1], functions)
    if (!Array.isArray(values)) throw new TypeError("Map expects a collection as its second argument")
    return Map(fn, values)
  }

  const fn = functions[expression.tag]
  if (!fn) throw new ReferenceError(`Unknown standard function: ${expression.tag}`)
  return fn(...expression.children.map(child => evaluateExpression(child, functions)))
}

function resolveFunction(
  expression: MatraASTChild,
  functions: Readonly<Record<string, StandardFunction>>,
): StandardFunction {
  if (typeof expression !== "string") {
    throw new TypeError("Map expects a function name as its first argument")
  }
  const fn = functions[expression]
  if (!fn) throw new ReferenceError(`Unknown Map function: ${expression}`)
  return fn
}

function requireNumber(value: MatraValue, name: string): number {
  if (typeof value !== "number") throw new TypeError(`${name} expects numeric arguments`)
  return value
}

function rangeTolerance(start: number, end: number, step: number): number {
  return Number.EPSILON * Math.max(1, Math.abs(start), Math.abs(end)) / Math.abs(step) * 4
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}
