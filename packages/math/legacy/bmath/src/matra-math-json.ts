import { evaluate, N, simplify } from "@cortex-js/compute-engine"
import parser from "../parser/matra-parser.cjs"

type MathJson = number | string | boolean | null | [string, ...MathJson[]]

type ParsedMatraNode = {
  head: string
  attributes: Record<string, unknown>
  children: unknown[]
}

function isNode(value: unknown): value is ParsedMatraNode {
  return typeof value === "object" && value !== null &&
    "head" in value && "attributes" in value && "children" in value
}

function matraNodeToMathJson(value: unknown): MathJson {
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean" || value === null) {
    return value
  }
  if (!isNode(value)) throw new Error("Matra input must produce a node or scalar value")
  if (Object.keys(value.attributes).length > 0) {
    throw new Error(`MathJSON function ${value.head} cannot have Matra attributes`)
  }
  if (value.head === "Formula") {
    if (value.children.length !== 1) throw new Error("Formula must contain exactly one expression")
    return matraNodeToMathJson(value.children[0])
  }
  if (value.children.length === 0) return value.head
  return [value.head, ...value.children.map(matraNodeToMathJson)]
}

function parseMatraMathJson(source: string): MathJson {
  try {
    return matraNodeToMathJson(parser.parse(source))
  } catch (error) {
    throw new Error(`Failed to parse Matra as MathJSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function evaluateMatra(source: string): unknown {
  return evaluate(parseMatraMathJson(source) as never).toMathJson()
}

function simplifyMatra(source: string): unknown {
  return simplify(parseMatraMathJson(source) as never).toMathJson()
}

function numericEvaluateMatra(source: string): unknown {
  return N(parseMatraMathJson(source) as never).toMathJson()
}

export {
  evaluateMatra,
  matraNodeToMathJson,
  numericEvaluateMatra,
  parseMatraMathJson,
  simplifyMatra,
}
export type { MathJson }
