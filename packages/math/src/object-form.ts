import type { MathExpression, MathExpressionList, MathJson, MathObjectForm } from "./types.js"

const seedKeys = ["base", "rational", "sin", "cos", "tan", "exp", "log", "abs", "eml"] as const
const complexKeys = ["re", "im"] as const
const operationKeys = ["power", "root", "times", "divide", "plus", "minus"] as const
const objectFormKeys = new Set<string>([...seedKeys, ...complexKeys, ...operationKeys])

const functionSeeds = {
  sin: "Sin",
  cos: "Cos",
  tan: "Tan",
  exp: "Exp",
  log: "Log",
  abs: "Abs",
} as const

/** Normalize MathJSON or convert Matra Object Form into canonical recursive MathJSON. */
export function toMathJson(expression: MathExpression): MathJson {
  if (isMathJsonScalar(expression)) return expression

  if (Array.isArray(expression)) {
    const [head, ...operands] = expression
    if (typeof head !== "string" || head.length === 0) {
      throw new TypeError("MathJSON function head must be a non-empty string")
    }
    return [head, ...operands.map(toMathJson)]
  }

  if (isPlainObject(expression)) return objectFormToMathJson(expression)

  throw new TypeError("Expression must be MathJSON or Matra Object Form")
}

/** Convert Matra Object Form into canonical recursive MathJSON. */
export function objectFormToMathJson(form: MathObjectForm): MathJson {
  if (!isPlainObject(form)) {
    throw new TypeError("Matra Object Form must be a plain object")
  }

  const keys = Object.keys(form)
  if (keys.length === 0) {
    throw new TypeError("Matra Object Form cannot be empty")
  }

  const unknownKey = keys.find((key) => !objectFormKeys.has(key))
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown Matra Object Form key: ${unknownKey}`)
  }

  let seed = seedFromForm(form)

  if (hasOwn(form, "power") || hasOwn(form, "root")) {
    assertHasSeed(seed, "power or root")
    const exponent = buildExponent(form)
    seed = ["Power", seed, exponent]
  }

  if (hasOwn(form, "times")) {
    assertHasSeed(seed, "times")
    seed = ["Multiply", seed, ...normalizeList(form.times)]
  }

  if (hasOwn(form, "divide")) {
    assertHasSeed(seed, "divide")
    seed = ["Divide", seed, ...normalizeList(form.divide)]
  }

  if (hasOwn(form, "plus")) {
    assertHasSeed(seed, "plus")
    seed = ["Add", seed, ...normalizeList(form.plus)]
  }

  if (hasOwn(form, "minus")) {
    assertHasSeed(seed, "minus")
    seed = ["Subtract", seed, ...normalizeList(form.minus)]
  }

  assertHasSeed(seed, "Matra Object Form")
  return seed
}

function seedFromForm(form: MathObjectForm): MathJson | undefined {
  const groups: string[] = []

  for (const key of seedKeys) {
    if (hasOwn(form, key)) groups.push(key)
  }

  const hasRe = hasOwn(form, "re")
  const hasIm = hasOwn(form, "im")
  if (hasRe || hasIm) groups.push("complex")

  if (groups.length > 1) {
    throw new TypeError("Matra Object Form cannot contain more than one seed")
  }

  if (hasRe !== hasIm) {
    throw new TypeError("Complex seed requires both re and im")
  }

  if (groups.length === 0) return undefined

  const seed = groups[0]
  if (seed === "base") return toMathJson(requiredExpression(form.base, "base seed"))
  if (seed === "complex") {
    return [
      "Complex",
      toMathJson(requiredExpression(form.re, "Complex re seed")),
      toMathJson(requiredExpression(form.im, "Complex im seed")),
    ]
  }
  if (seed === "rational") {
    const [numerator, denominator] = normalizeTuple(form.rational, "rational")
    return ["Rational", numerator, denominator]
  }
  if (seed === "eml") {
    const [left, right] = normalizeTuple(form.eml, "eml")
    return ["Eml", left, right]
  }

  const head = functionSeeds[seed as keyof typeof functionSeeds]
  return [head, toMathJson(requiredExpression(form[seed as keyof typeof functionSeeds], `${seed} seed`))]
}

function buildExponent(form: MathObjectForm): MathJson {
  if (hasOwn(form, "power") && hasOwn(form, "root")) {
    return [
      "Divide",
      toMathJson(requiredExpression(form.power, "power layer")),
      toMathJson(requiredExpression(form.root, "root layer")),
    ]
  }
  if (hasOwn(form, "root")) {
    return ["Divide", 1, toMathJson(requiredExpression(form.root, "root layer"))]
  }
  return toMathJson(requiredExpression(form.power, "power layer"))
}

function normalizeList(expressionList: MathExpressionList | undefined): MathJson[] {
  if (expressionList === undefined) {
    throw new TypeError("Operation layer value cannot be undefined")
  }
  return Array.isArray(expressionList) ? expressionList.map(toMathJson) : [toMathJson(expressionList)]
}

function normalizeTuple(
  tuple: [MathExpression, MathExpression] | undefined,
  name: string,
): [MathJson, MathJson] {
  if (!Array.isArray(tuple) || tuple.length !== 2) {
    throw new TypeError(`${name} seed must contain exactly two expressions`)
  }
  return [toMathJson(tuple[0]), toMathJson(tuple[1])]
}

function requiredExpression(expression: MathExpression | undefined, label: string): MathExpression {
  if (expression === undefined) {
    throw new TypeError(`${label} cannot be undefined`)
  }
  return expression
}

function assertHasSeed(seed: MathJson | undefined, label: string): asserts seed is MathJson {
  if (seed === undefined) {
    throw new TypeError(`${label} requires a seed`)
  }
}

function isMathJsonScalar(expression: unknown): expression is MathJson {
  return (
    expression === null ||
    typeof expression === "number" ||
    typeof expression === "string" ||
    typeof expression === "boolean"
  )
}

function isPlainObject(expression: unknown): expression is MathObjectForm {
  return (
    typeof expression === "object" &&
    expression !== null &&
    !Array.isArray(expression) &&
    Object.getPrototypeOf(expression) === Object.prototype
  )
}

function hasOwn<T extends object, K extends PropertyKey>(object: T, key: K): object is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(object, key)
}
