import { isMatraAST, parse, type MatraAST, type MatraASTChild, type UnifiedExpression } from "@matra/core"
import type { MathJson } from "./types.js"

/** Convert a Core AST into the canonical recursive MathJSON representation. */
export function astToMathJson(ast: MatraAST): MathJson {
  if (Object.keys(ast.props).length > 0) {
    throw new TypeError(`MathJSON expression ${ast.tag} cannot have Matra props`)
  }
  if (ast.tag === "Formula") {
    if (ast.children.length !== 1) {
      throw new TypeError("Formula must contain exactly one expression")
    }
    return childToMathJson(ast.children[0])
  }
  if (ast.children.length === 0) return ast.tag
  return [ast.tag, ...ast.children.map(childToMathJson)]
}

/** Parse application-style Matra and convert it to MathJSON. */
export function parseMath(source: string): MathJson {
  try {
    const statements = parse(source).statements
    if (statements.length !== 1 || statements[0].kind !== "expression") {
      throw new SyntaxError("MathJSON source must contain exactly one expression")
    }
    return expressionToMathJson(statements[0].expression)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new SyntaxError(`Failed to parse Matra as MathJSON: ${message}`, { cause: error })
  }
}

function expressionToMathJson(expression: UnifiedExpression): MathJson {
  if (expression.kind === "literal") return expression.value
  if (expression.kind === "array") return expression.items.map(expressionToMathJson) as MathJson
  if (expression.kind === "reference") return expression.name
  if (expression.kind === "call" && expression.callee.kind === "reference") {
    if (expression.callee.name === "Formula") {
      if (expression.arguments.length !== 1) throw new TypeError("Formula expects exactly one expression")
      return expressionToMathJson(expression.arguments[0])
    }
    return [expression.callee.name, ...expression.arguments.map(expressionToMathJson)]
  }
  throw new TypeError(`MathJSON does not support unified ${expression.kind} expressions`)
}

/** Convert MathJSON to a Core AST. Scalar roots have no Matra AST equivalent. */
export function mathJsonToAST(expression: MathJson): MatraAST {
  if (!Array.isArray(expression)) {
    if (typeof expression === "string") {
      return { tag: expression, props: {}, children: [] }
    }
    throw new TypeError("A scalar MathJSON root cannot be represented as a Matra AST")
  }
  const [tag, ...operands] = expression
  if (typeof tag !== "string" || tag.length === 0) {
    throw new TypeError("MathJSON function head must be a non-empty string")
  }
  return { tag, props: {}, children: operands.map(mathJsonChildToAST) }
}

function childToMathJson(child: MatraASTChild): MathJson {
  if (isMatraAST(child)) return astToMathJson(child)
  if (child === null || typeof child === "string" || typeof child === "number" || typeof child === "boolean") return child
  throw new TypeError("MathJSON operands must be scalar values or Matra nodes")
}

function mathJsonChildToAST(expression: MathJson): MatraASTChild {
  return Array.isArray(expression) ? mathJsonToAST(expression) : expression
}
