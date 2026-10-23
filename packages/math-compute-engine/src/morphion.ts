import { evaluate as computeEvaluate } from "@cortex-js/compute-engine"
import type { MathJson, MathJsonFunction, MorphionForm } from "@matra/math"

const MAX_MORPHION_TERMS = 256
const IMAGINARY_UNIT: MathJson = "ImaginaryUnit"
const ZERO: MathJson = 0
const ONE: MathJson = 1

interface Factor {
  base: MathJson
  exponent: number
}

interface Term {
  coeff: MathJson
  factors: Map<string, Factor>
}

type Form = Map<string, Term>

/** Convert MathJSON to a multivariate Morphion form with function calls as atoms. */
export function morphionize(expression: MathJson): MorphionForm {
  const form = toForm(expression, 0)
  const factors = new Map<string, MathJson>()
  for (const term of form.values()) {
    for (const [key, factor] of term.factors) factors.set(key, factor.base)
  }
  const bases = [...factors.entries()].sort(([left], [right]) => left.localeCompare(right))
  const terms = [...form.values()]
    .map(term => ({
      key: bases.map(([key]) => term.factors.get(key)?.exponent ?? 0),
      coeff: term.coeff,
    }))
    .sort((left, right) => compareExponentVectors(left.key, right.key))

  return {
    head: "MorphionForm",
    attributes: { bases: bases.map(([, base]) => base), terms },
  }
}

function toForm(expression: MathJson, depth: number): Form {
  if (depth > 80) throw new RangeError("Morphion expression exceeds maximum nesting depth")
  if (typeof expression === "number") return constant(expression)
  if (!Array.isArray(expression)) return atom(expression)

  const [head, ...operands] = expression
  if (typeof head !== "string") return atom(expression)
  if (head === "Rational" && operands.length === 2) return constant(expression)
  if (head === "Complex" && operands.length === 2) {
    return addForms(toForm(operands[0], depth + 1), multiplyForms(toForm(operands[1], depth + 1), atom(IMAGINARY_UNIT)))
  }
  if (head === "Add") return operands.reduce<Form>((result, operand) => addForms(result, toForm(operand, depth + 1)), new Map())
  if (head === "Subtract") {
    if (operands.length === 0) return atom(expression)
    const [first, ...rest] = operands
    return rest.reduce<Form>((result, operand) => addForms(result, scaleForm(toForm(operand, depth + 1), -1)), toForm(first, depth + 1))
  }
  if (head === "Negate" && operands.length === 1) return scaleForm(toForm(operands[0], depth + 1), -1)
  if (head === "Multiply") {
    return operands.reduce<Form>((result, operand) => multiplyForms(result, toForm(operand, depth + 1)), constant(ONE))
  }
  if (head === "Divide" && operands.length === 2) {
    const denominator = toForm(operands[1], depth + 1)
    if (denominator.size !== 1) return atom(expression)
    const term = denominator.values().next().value as Term
    if (isZero(term.coeff)) return atom(expression)
    return multiplyForms(toForm(operands[0], depth + 1), invertMonomial(term))
  }
  if (head === "Power" && operands.length === 2) {
    const exponent = integerValue(operands[1])
    if (exponent !== undefined) {
      const powered = powerForm(toForm(operands[0], depth + 1), exponent)
      if (powered !== undefined) return powered
    }
  }
  return atom(expression)
}

function atom(expression: MathJson): Form {
  return singleton({
    coeff: ONE,
    factors: new Map([[keyOf(expression), { base: expression, exponent: 1 }]]),
  })
}

function constant(coefficient: MathJson): Form {
  const normalized = normalizeCoefficient(coefficient)
  return isZero(normalized) ? new Map() : singleton({ coeff: normalized, factors: new Map() })
}

function singleton(term: Term): Form {
  return new Map([[monomialKey(term.factors), term]])
}

function addForms(left: Form, right: Form): Form {
  const result = new Map<string, Term>()
  for (const term of left.values()) mergeTerm(result, term)
  for (const term of right.values()) mergeTerm(result, term)
  return result
}

function multiplyForms(left: Form, right: Form): Form {
  if (left.size === 0 || right.size === 0) return new Map()
  const result = new Map<string, Term>()
  for (const leftTerm of left.values()) {
    for (const rightTerm of right.values()) {
      const factors = new Map(leftTerm.factors)
      for (const [key, factor] of rightTerm.factors) {
        const exponent = (factors.get(key)?.exponent ?? 0) + factor.exponent
        if (exponent === 0) factors.delete(key)
        else factors.set(key, { base: factor.base, exponent })
      }
      mergeTerm(result, {
        coeff: multiplyCoefficients(leftTerm.coeff, rightTerm.coeff),
        factors,
      })
    }
  }
  return result
}

function scaleForm(form: Form, scale: number): Form {
  if (scale === 0) return new Map()
  const result = new Map<string, Term>()
  for (const term of form.values()) {
    mergeTerm(result, { ...term, coeff: multiplyCoefficients(term.coeff, scale) })
  }
  return result
}

function powerForm(form: Form, exponent: number): Form | undefined {
  if (!Number.isSafeInteger(exponent)) return undefined
  if (exponent === 0) return constant(ONE)
  if (exponent < 0) {
    if (form.size !== 1) return undefined
    const term = form.values().next().value as Term
    return powerMonomial(term, exponent)
  }

  let result = constant(ONE)
  let factor = form
  let remaining = exponent
  while (remaining > 0) {
    if (remaining % 2 === 1) result = multiplyForms(result, factor)
    remaining = Math.floor(remaining / 2)
    if (remaining > 0) factor = multiplyForms(factor, factor)
  }
  return result
}

function powerMonomial(term: Term, exponent: number): Form {
  const factors = new Map<string, Factor>()
  for (const [key, factor] of term.factors) {
    const power = factor.exponent * exponent
    if (!Number.isSafeInteger(power)) throw new RangeError("Morphion exponent exceeds the safe integer range")
    if (power !== 0) factors.set(key, { base: factor.base, exponent: power })
  }
  return singleton({ coeff: powerCoefficient(term.coeff, exponent), factors })
}

function invertMonomial(term: Term): Form {
  return powerMonomial(term, -1)
}

function mergeTerm(target: Form, term: Term): void {
  const key = monomialKey(term.factors)
  const previous = target.get(key)
  const coeff = previous ? addCoefficients(previous.coeff, term.coeff) : normalizeCoefficient(term.coeff)
  if (isZero(coeff)) target.delete(key)
  else target.set(key, { coeff, factors: new Map(term.factors) })
  if (target.size > MAX_MORPHION_TERMS) {
    throw new RangeError(`Morphion expansion exceeds ${MAX_MORPHION_TERMS} terms`)
  }
}

function addCoefficients(left: MathJson, right: MathJson): MathJson {
  if (isZero(left)) return right
  if (isZero(right)) return left
  return normalizeCoefficient(["Add", left, right] as MathJsonFunction)
}

function multiplyCoefficients(left: MathJson, right: MathJson): MathJson {
  if (isZero(left) || isZero(right)) return ZERO
  if (isOne(left)) return right
  if (isOne(right)) return left
  return normalizeCoefficient(["Multiply", left, right] as MathJsonFunction)
}

function powerCoefficient(coefficient: MathJson, exponent: number): MathJson {
  return normalizeCoefficient(["Power", coefficient, exponent] as MathJsonFunction)
}

function normalizeCoefficient(expression: MathJson): MathJson {
  const value = computeEvaluate(expression as never).toMathJson()
  if (typeof value === "string") return recurringDecimalToRational(value) ?? value
  return value as MathJson
}

function recurringDecimalToRational(value: string): MathJson | undefined {
  const match = value.match(/^(-?)(\d*)\.(\d*)\((\d+)\)$/)
  if (!match) return undefined
  const [, sign, wholePart, nonRepeating, repeating] = match
  const scale = 10n ** BigInt(nonRepeating.length)
  const cycle = 10n ** BigInt(repeating.length) - 1n
  const denominator = scale * cycle
  let numerator = BigInt(wholePart || "0") * denominator + BigInt(nonRepeating || "0") * cycle + BigInt(repeating)
  if (sign === "-") numerator = -numerator
  const divisor = greatestCommonDivisor(numerator, denominator)
  numerator /= divisor
  const reducedDenominator = denominator / divisor
  if (!Number.isSafeInteger(Number(numerator)) || !Number.isSafeInteger(Number(reducedDenominator))) return undefined
  return reducedDenominator === 1n ? Number(numerator) : (["Rational", Number(numerator), Number(reducedDenominator)] as MathJsonFunction)
}

function integerValue(value: MathJson): number | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value
  if (Array.isArray(value) && value[0] === "Rational" && value.length === 3 && value[2] === 1 && Number.isSafeInteger(value[1])) {
    return value[1] as number
  }
  return undefined
}

function isZero(value: MathJson): boolean {
  if (value === 0) return true
  return Array.isArray(value) && value[0] === "Rational" && value.length === 3 && value[1] === 0
}

function isOne(value: MathJson): boolean {
  if (value === 1) return true
  return Array.isArray(value) && value[0] === "Rational" && value.length === 3 && value[1] === value[2]
}

function monomialKey(factors: Map<string, Factor>): string {
  return JSON.stringify([...factors.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, factor]) => [key, factor.exponent]))
}

function keyOf(expression: MathJson): string {
  return JSON.stringify(expression)
}

function compareExponentVectors(left: number[], right: number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left
  let b = right < 0n ? -right : right
  while (b !== 0n) [a, b] = [b, a % b]
  return a || 1n
}
