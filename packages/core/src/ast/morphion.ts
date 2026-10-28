import { isMatraAST } from "./convert.js"
import type { MatraAST, MatraASTChild, MatraValue } from "./types.js"

/** 文書nodeの指数と係数。0はtag、正整数はchild、文字列はpropertyを表す。 */
export interface MatraMorphionTerm {
  readonly exponent: number | string
  readonly val: MatraASTChild
}

/** node単位の有限項表現。係数内の子nodeは既存の文書ASTで保持する。 */
export type MatraMorphion = readonly MatraMorphionTerm[]

/** 文書ASTを0、1…n、文字列keyの順でMorphion項へ写す。 */
export function astToMorphion(ast: MatraAST): MatraMorphion {
  if (!isMatraAST(ast)) throw new TypeError("Morphion conversion requires a document AST")
  const node = cloneCoefficient(ast) as MatraAST
  return [
    { exponent: 0, val: node.tag },
    ...node.children.map((val, index) => ({ exponent: index + 1, val })),
    ...Object.keys(node.props)
      .sort()
      .map(exponent => ({ exponent, val: node.props[exponent] })),
  ]
}

/** 項の入力順に依存せず文書ASTへ戻す。重複指数やchildの欠番は拒否する。 */
export function morphionToAST(terms: MatraMorphion): MatraAST {
  if (!Array.isArray(terms)) throw new TypeError("Morphion must be an array of terms")
  const seen = new Set<number | string>()
  const children = new Map<number, MatraASTChild>()
  const props: [string, MatraASTChild][] = []
  let tag: string | undefined
  for (const term of terms) {
    if (term === null || typeof term !== "object") throw new TypeError("Invalid Morphion term")
    const { exponent, val } = term
    if (
      typeof exponent !== "string" &&
      !(typeof exponent === "number" && Number.isSafeInteger(exponent) && exponent >= 0)
    ) {
      throw new TypeError("Morphion exponent must be a string or a non-negative safe integer")
    }
    if (seen.has(exponent)) throw new TypeError("Duplicate Morphion exponent")
    seen.add(exponent)
    if (exponent === 0) {
      if (typeof val !== "string")
        throw new TypeError("Morphion exponent 0 must contain a tag string")
      tag = val
    } else if (typeof exponent === "number") children.set(exponent, cloneCoefficient(val))
    else props.push([exponent, cloneCoefficient(val)])
  }
  if (tag === undefined) throw new TypeError("Morphion requires a tag at exponent 0")
  for (const exponent of children.keys()) {
    if (exponent > children.size)
      throw new TypeError("Morphion child exponents must be contiguous from 1")
  }
  return {
    tag,
    props: Object.fromEntries(
      props.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    ),
    children: Array.from(
      { length: children.size },
      (_, index) => children.get(index + 1) as MatraASTChild,
    ),
  }
}

// ASTとして認識するのはproperty/child直下だけ。配列・map内部のデータをnodeに再解釈しない。
function cloneCoefficient(value: unknown, active = new Set<object>()): MatraASTChild {
  if (!isMatraAST(value)) return cloneValue(value, active)
  enter(value, active)
  try {
    return {
      tag: value.tag,
      props: Object.fromEntries(
        Object.entries(value.props).map(([key, val]) => [key, cloneCoefficient(val, active)]),
      ),
      children: Array.from(value.children, child => cloneCoefficient(child, active)),
    }
  } finally {
    active.delete(value)
  }
}

function cloneValue(value: unknown, active: Set<object>): MatraValue {
  if (value === null) return null
  if (typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "object" || value === null)
    throw new TypeError("Morphion coefficients must be JSON-compatible values or document nodes")
  enter(value, active)
  try {
    if (Array.isArray(value)) return Array.from(value, item => cloneValue(item, active))
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      throw new TypeError("Morphion coefficient maps must be plain objects")
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, cloneValue(val, active)]),
    )
  } finally {
    active.delete(value)
  }
}

function enter(value: object, active: Set<object>): void {
  if (active.has(value)) throw new TypeError("Morphion coefficients must not contain cycles")
  active.add(value)
}
