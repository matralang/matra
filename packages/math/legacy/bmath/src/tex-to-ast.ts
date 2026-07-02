import { LatexSyntax } from "@cortex-js/compute-engine/latex-syntax"
import type { MatraNode } from "./types"

type MathJson = number | string | { num: string } | [string, ...MathJson[]]

const latexSyntax = new LatexSyntax()
const node = (head: string, children: MatraNode["children"]): MatraNode =>
  ({ head, attributes: {}, children })

function hasParseError(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value[0] === "Error" || value.some(hasParseError)
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some(hasParseError)
  }
  return false
}

function mathJsonToAst(expression: MathJson): MatraNode {
  if (typeof expression === "number") return node("Const", [String(expression)])
  if (typeof expression === "string") {
    if (expression === "Pi") return node("Const", ["Pi"])
    if (expression === "ExponentialE" || expression === "e") return node("Const", ["E"])
    return node("Var", [expression])
  }
  if (!Array.isArray(expression)) return node("Const", [expression.num])

  const [operator, ...operands] = expression
  const children = () => operands.map(mathJsonToAst)

  switch (operator) {
    case "Add":
      return node("Add", children())
    case "Subtract":
      return node("Add", [
        mathJsonToAst(operands[0]),
        node("Mul", [node("Const", ["-1"]), mathJsonToAst(operands[1])]),
      ])
    case "Multiply":
    case "InvisibleOperator": {
      if (
        operands.length === 2 && typeof operands[0] === "string" &&
        Array.isArray(operands[1]) && operands[1][0] === "Delimiter"
      ) {
        return node("Call", [node("Var", [operands[0]]), mathJsonToAst(operands[1][1])])
      }
      return node("Mul", children())
    }
    case "Divide":
    case "Rational":
      return node("Div", children())
    case "Power":
      return node("Pow", children())
    case "Square":
      return node("Pow", [mathJsonToAst(operands[0]), node("Const", ["2"])])
    case "Negate":
      return node("Mul", [node("Const", ["-1"]), mathJsonToAst(operands[0])])
    case "Delimiter":
      return mathJsonToAst(operands[0])
    case "Sin":
    case "Cos":
      return node(operator, children())
    case "Error":
      throw new Error("Invalid TeX expression")
    default:
      return node("Call", [node("Var", [operator]), ...children()])
  }
}

function texToAst(input: string): MatraNode {
  const source = input.trim()
  if (/^[A-Za-z]+$/.test(source)) {
    return source === "e" ? node("Const", ["E"]) : node("Var", [source])
  }

  const expression = latexSyntax.parse(input)
  if (expression === null || hasParseError(expression)) {
    throw new Error("Empty or invalid TeX expression")
  }
  return mathJsonToAst(expression as unknown as MathJson)
}

export { texToAst }
