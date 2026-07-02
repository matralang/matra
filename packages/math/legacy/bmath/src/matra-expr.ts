import type { Expr } from "./types"
import type { PolynarionForm } from "./types"
import type { MatraNode } from "./ast-to-tex"
import { astToTeX } from "./ast-to-tex"
import { texToAst } from "./tex-to-ast"
import { int, plus, power, sym, times, call } from "./expr"
import { toMorphionForm } from "./utils"
import parser from "../parser/matra-parser.cjs"

const parseMatra = (source: string): MatraNode => {
  try {
    return parser.parse(source)
  } catch (error) {
    throw new Error(`Failed to parse Matra expression: ${error}`)
  }
}

type ExprMatraHead = "Integer" | "Symbol" | "Plus" | "Times" | "Power" | "Call"
type ExprMatraNode = { head: ExprMatraHead, attributes: Record<string, any>, children: ExprMatraNode[] }
type FormulaNode = { head: "Formula", attributes: Record<string, any>, children: [ExprMatraNode] }
type ParsedMatraNode = {
  head: string
  attributes: Record<string, unknown>
  children: Array<ParsedMatraNode | string | number | boolean>
}

function asParsedNode(value: unknown): ParsedMatraNode {
  if (
    typeof value !== "object" || value === null ||
    !("head" in value) || !("attributes" in value) || !("children" in value)
  ) {
    throw new Error("Matra expression must produce a node")
  }
  return value as ParsedMatraNode
}

function parsedMatraNodeToExpr(node: ParsedMatraNode): Expr {
  const children = () => node.children.map((child) =>
    parsedMatraNodeToExpr(asParsedNode(child)))

  switch (node.head) {
    case "Integer":
      return int(BigInt(String(node.attributes.value)))
    case "Symbol":
      return sym(String(node.attributes.name))
    case "Plus":
      return plus(...children())
    case "Times":
      return times(...children())
    case "Power": {
      const [base, exponent, ...rest] = children()
      if (!base || !exponent || rest.length > 0) {
        throw new Error("Invalid Power node: children length must be 2")
      }
      return power(base, exponent)
    }
    case "Call": {
      if (Object.keys(node.attributes).length > 0 || node.children.length !== 2) {
        throw new Error("Invalid Call node: function and argument must be children")
      }
      const fn = asParsedNode(node.children[0])
      if (fn.head !== "Symbol" || typeof fn.attributes.name !== "string") {
        throw new Error("Call function must be a Symbol node")
      }
      return call(fn.attributes.name, parsedMatraNodeToExpr(asParsedNode(node.children[1])))
    }
    default:
      throw new Error(`Unsupported parsed Matra head: ${node.head}`)
  }
}

function parseMatraExpr(source: string): Expr {
  return parsedMatraNodeToExpr(asParsedNode(parseMatra(source)))
}

function parseMatraFormula(source: string): Expr {
  const formula = asParsedNode(parseMatra(source))
  if (formula.head !== "Formula" || formula.children.length !== 1) {
    throw new Error("Matra formula must contain exactly one expression")
  }
  return parsedMatraNodeToExpr(asParsedNode(formula.children[0]))
}

function isExprMatraNode(node: MatraNode): node is ExprMatraNode {
  return node.head === "Integer" || node.head === "Symbol" || node.head === "Plus" || node.head === "Times" || node.head === "Power" || node.head === "Call"
}

function exprToMatraExprNode(expr: Expr): ExprMatraNode {
  if (expr.head === "Integer") {
    return { head: "Integer", attributes: { value: expr.attributes.value.toString() }, children: [] }
  }

  if (expr.head === "Symbol") {
    return { head: "Symbol", attributes: { name: expr.attributes.name }, children: [] }
  }

  if (expr.head === "Plus") {
    return { head: "Plus", attributes: {}, children: expr.attributes.terms.map(exprToMatraExprNode) }
  }

  if (expr.head === "Times") {
    return { head: "Times", attributes: {}, children: expr.attributes.factors.map(exprToMatraExprNode) }
  }

  if (expr.head === "Power") {
    return { head: "Power", attributes: {}, children: [exprToMatraExprNode(expr.attributes.base), exprToMatraExprNode(expr.attributes.exp)] }
  }

  if (expr.head === "Call") {
    return {
      head: "Call",
      attributes: {},
      children: [
        { head: "Symbol", attributes: { name: expr.attributes.fn }, children: [] },
        exprToMatraExprNode(expr.attributes.arg),
      ],
    }
  }

  throw new Error(`Unsupported Expr head for Matra conversion: ${expr.head}`)
}

function matraExprNodeToExpr(node: ExprMatraNode): Expr {
  const { head, attributes, children } = node

  if (head === "Integer") {
    if (typeof attributes.value !== "string") {
      throw new Error("Invalid Integer node: attributes.value must be string")
    }
    return { head: "Integer", attributes: { value: BigInt(attributes.value) } }
  }

  if (head === "Symbol") {
    if (typeof attributes.name !== "string") {
      throw new Error("Invalid Symbol node: attributes.name must be string")
    }
    return { head: "Symbol", attributes: { name: attributes.name } }
  }

  if (head === "Plus") {
    return { head: "Plus", attributes: { terms: children.map(matraExprNodeToExpr) } }
  }

  if (head === "Times") {
    return { head: "Times", attributes: { factors: children.map(matraExprNodeToExpr) } }
  }

  if (head === "Power") {
    if (children.length !== 2) {
      throw new Error("Invalid Power node: children length must be 2")
    }
    return {
      head: "Power",
      attributes: {
        base: matraExprNodeToExpr(children[0]),
        exp: matraExprNodeToExpr(children[1]),
      },
    }
  }

  if (head === "Call") {
    if (children.length !== 2) {
      throw new Error("Invalid Call node: children length must be 2")
    }
    const fnNode = children[0]
    if (fnNode.head !== "Symbol") {
      throw new Error("Call function must be a Symbol node")
    }
    return {
      head: "Call",
      attributes: {
        fn: String((fnNode as any).attributes.name),
        arg: matraExprNodeToExpr(children[1]),
      },
    }
  }

  throw new Error(`Unsupported Matra tag for Expr conversion: ${head}`)
}

function exprToFormulaNode(expr: Expr): FormulaNode {
  return { head: "Formula", attributes: {}, children: [exprToMatraExprNode(expr)] }
}

function toFormulaNode(node: MatraNode): FormulaNode {
  if (node.head === "Formula") {
    const { children } = node
    if (!Array.isArray(children) || children.length !== 1) {
      throw new Error("Invalid Formula node: children length must be 1")
    }
    const exprNode = children[0]
    if (!isExprMatraNode(exprNode as MatraNode)) {
      throw new Error("Invalid Formula node: children[0] must be Expr Matra node")
    }
    return node as FormulaNode
  }

  if (isExprMatraNode(node)) {
    return { head: "Formula", attributes: {}, children: [node] }
  }

  throw new Error(`Unsupported node for formula conversion: ${node.head}`)
}

function formulaNodeToExpr(node: MatraNode): Expr {
  const formula = toFormulaNode(node)
  return matraExprNodeToExpr(formula.children[0])
}

function parseFormula(node: MatraNode | string): Expr {
  return typeof node === "string" ? parseMatraFormula(node) : formulaNodeToExpr(node)
}

function texMathNodeToExpr(node: MatraNode): Expr {
  const { head, children } = node

  if (head === "Const") {
    const val = String(children[0])
    if (/^-?\d+$/.test(val)) {
      return int(BigInt(val))
    }
    if (val === "E") {
      return sym("e")
    }
    if (val === "Pi") {
      return sym("pi")
    }
    throw new Error(`Unsupported Const value for Expr conversion: ${val}`)
  }

  if (head === "Var") {
    return sym(String(children[0]))
  }

  if (head === "Add") {
    return plus(...(children as MatraNode[]).map(texMathNodeToExpr))
  }

  if (head === "Mul") {
    return times(...(children as MatraNode[]).map(texMathNodeToExpr))
  }

  if (head === "Pow") {
    if (children.length !== 2) {
      throw new Error("Invalid Pow node: children length must be 2")
    }
    return power(texMathNodeToExpr(children[0] as MatraNode), texMathNodeToExpr(children[1] as MatraNode))
  }

  if (head === "Div") {
    if (children.length !== 2) {
      throw new Error("Invalid Div node: children length must be 2")
    }
    return times(
      texMathNodeToExpr(children[0] as MatraNode),
      power(texMathNodeToExpr(children[1] as MatraNode), int(-1n)),
    )
  }

  if (head === "Sin" || head === "Cos") {
    if (children.length !== 1) {
      throw new Error(`Invalid ${head} node: children length must be 1`)
    }
    return call(head.toLowerCase(), texMathNodeToExpr(children[0] as MatraNode))
  }

  if (head === "Call") {
    if (children.length !== 2) {
      throw new Error("Invalid Call node: children length must be 2")
    }
    const fn = children[0] as MatraNode
    if (fn.head !== "Var") {
      throw new Error("Call function must be a Var node")
    }
    return call(String(fn.children[0]), texMathNodeToExpr(children[1] as MatraNode))
  }

  throw new Error(`Unsupported TeX math node for Expr conversion: ${head}`)
}

function texToExpr(tex: string): Expr {
  return texMathNodeToExpr(texToAst(tex))
}

function texToFormulaNode(tex: string): FormulaNode {
  return exprToFormulaNode(texToExpr(tex))
}

function exprToMorphion(expr: Expr): PolynarionForm {
  return toMorphionForm(expr)
}

function formulaNodeToMorphion(node: MatraNode): PolynarionForm {
  return exprToMorphion(formulaNodeToExpr(node))
}

function texToMorphion(tex: string): PolynarionForm {
  return exprToMorphion(texToExpr(tex))
}

// Mock: TeX input → Matra AST → TeX output (direct TeX processing)
function processMatrixTeX(texInput: string, mode: "conventional" | "consistent" = "conventional"): string {
  try {
    const ast = texToAst(texInput)
    return astToTeX(ast, mode)
  } catch (error) {
    // On parse error, return input as-is
    return texInput
  }
}

// Mock: Batch process multiple TeX expressions
function processBatchTeX(texExpressions: string[], mode: "conventional" | "consistent" = "conventional"): string[] {
  return texExpressions.map((tex) => processMatrixTeX(tex, mode))
}

export {
  exprToMatraExprNode,
  matraExprNodeToExpr,
  exprToFormulaNode,
  formulaNodeToExpr,
  toFormulaNode,
  parseFormula,
  parseMatraExpr,
  parseMatraFormula,
  texMathNodeToExpr,
  texToExpr,
  texToFormulaNode,
  exprToMorphion,
  formulaNodeToMorphion,
  texToMorphion,
  processMatrixTeX,
  processBatchTeX,
}
export type { ExprMatraNode, FormulaNode }
