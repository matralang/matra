/// <reference types="jest" />
import { int, plus, power, sym, times, call } from "../src/expr"
import { toExpression } from "../src/utils"
import {
  exprToFormulaNode,
  exprToMatraExprNode,
  formulaNodeToExpr,
  formulaNodeToMorphion,
  matraExprNodeToExpr,
  parseFormula,
  parseMatraExpr,
  parseMatraFormula,
  texMathNodeToExpr,
  texToExpr,
  texToFormulaNode,
  texToMorphion,
  toFormulaNode,
  processMatrixTeX,
  processBatchTeX,
} from "../src/matra-expr"

describe("matra-expr bridge", () => {
  test("Expr -> ExprMatraNode", () => {
    const expr = plus(times(int(2n), sym("x")), power(sym("y"), int(2n)))

    expect(exprToMatraExprNode(expr)).toEqual({
      head: "Plus",
      attributes: {},
      children: [
        {
          head: "Times",
          attributes: {},
          children: [
            { head: "Integer", attributes: { value: "2" }, children: [] },
            { head: "Symbol", attributes: { name: "x" }, children: [] },
          ],
        },
        {
          head: "Power",
          attributes: {},
          children: [
            { head: "Symbol", attributes: { name: "y" }, children: [] },
            { head: "Integer", attributes: { value: "2" }, children: [] },
          ],
        },
      ],
    })
  })

  test("ExprMatraNode -> Expr", () => {
    const node = {
      head: "Times",
      attributes: {},
      children: [
        { head: "Integer", attributes: { value: "3" }, children: [] },
        { head: "Symbol", attributes: { name: "x" }, children: [] },
      ],
    } as const

    expect(matraExprNodeToExpr(node as any)).toEqual(times(int(3n), sym("x")))
  })

  test("Expr -> FormulaNode -> Expr", () => {
    const expr = plus(sym("x"), int(1n))
    const formula = exprToFormulaNode(expr)

    expect(formula).toEqual({
      head: "Formula",
      attributes: {},
      children: [{ head: "Plus", attributes: {}, children: [{ head: "Integer", attributes: { value: "1" }, children: [] }, { head: "Symbol", attributes: { name: "x" }, children: [] }] }],
    } as const)
    expect(formulaNodeToExpr(formula as any)).toEqual(expr)
  })

  test("FormulaNode validation", () => {
    expect(() => formulaNodeToExpr({ head: "Formula", attributes: {}, children: [] } as any)).toThrow("Invalid Formula node: children length must be 1")
  })

  test("ExprMatraNode -> FormulaNode (normalize entry)", () => {
    const node = { head: "Integer", attributes: { value: "7" }, children: [] } as any
    expect(toFormulaNode(node)).toEqual({ head: "Formula", attributes: {}, children: [{ head: "Integer", attributes: { value: "7" }, children: [] }] })
  })

  test("Matra parser -> Expr", () => {
    expect(parseMatraExpr('Plus(Integer(value="1"), Symbol(name="x"))'))
      .toEqual(plus(int(1n), sym("x")))
  })

  test("Matra parser -> Call", () => {
    expect(parseMatraExpr('Call(Symbol(name="sin"), Symbol(name="x"))'))
      .toEqual(call("sin", sym("x")))
    expect(() => parseMatraExpr('Call(fn="sin", Symbol(name="x"))'))
      .toThrow("function and argument must be children")
  })

  test("Matra parser -> Formula -> Expr", () => {
    const source = 'Formula(Power(Symbol(name="x"), Integer(value="2")))'
    expect(parseMatraFormula(source)).toEqual(power(sym("x"), int(2n)))
    expect(parseFormula(source)).toEqual(power(sym("x"), int(2n)))
  })

  test("FormulaNode -> MorphionForm", () => {
    const formula = { head: "Formula", attributes: {}, children: [{ head: "Power", attributes: {}, children: [{ head: "Symbol", attributes: { name: "x" }, children: [] }, { head: "Integer", attributes: { value: "2" }, children: [] }] }] } as any
    const morphion = formulaNodeToMorphion(formula)

    expect(morphion.head).toBe("MorphionForm")
    expect(morphion.attributes.base).toEqual(sym("x"))
    expect(Array.from(morphion.attributes.terms.values())).toEqual([{ key: int(2n), coeff: int(1n) }])
  })

  test("TeX AST node -> Expr", () => {
    const node = { head: "Pow", attributes: {}, children: [{ head: "Var", attributes: {}, children: ["x"] }, { head: "Const", attributes: {}, children: ["2"] }] } as any
    expect(texMathNodeToExpr(node)).toEqual(power(sym("x"), int(2n)))
  })

  test("TeX string -> Expr", () => {
    expect(texToExpr("2x + y^{2}")).toEqual(plus(times(int(2n), sym("x")), power(sym("y"), int(2n))))
  })

  test("TeX string -> FormulaNode", () => {
    expect(texToFormulaNode("x^{2}")).toEqual({
      head: "Formula",
      attributes: {},
      children: [{
        head: "Power",
        attributes: {},
        children: [
          { head: "Symbol", attributes: { name: "x" }, children: [] },
          { head: "Integer", attributes: { value: "2" }, children: [] }
        ]
      }]
    })
  })

  test("TeX string -> MorphionForm", () => {
    const morphion = texToMorphion("x^{2}")
    expect(morphion.head).toBe("MorphionForm")
    expect(morphion.attributes.base).toEqual(sym("x"))
    expect(Array.from(morphion.attributes.terms.values())).toEqual([{ key: int(2n), coeff: int(1n) }])
  })

  test("TeX sin/cos -> Expr Call (not an error anymore)", () => {
    expect(texToExpr("\\sin x")).toEqual(call("sin", sym("x")))
    expect(texToExpr("\\cos(x)")).toEqual(call("cos", sym("x")))
  })

  test("Call construction", () => {
    const expr = call("sin", sym("x"))
    expect(expr).toEqual({ head: "Call", attributes: { fn: "sin", arg: sym("x") } })
  })

  test("Call to expression string", () => {
    const expr = call("sin", plus(sym("x"), int(1n)))
    expect(toExpression(expr)).toBe("sin(1 + x)")
  })

  test("Expr with Call -> Matra ExprNode", () => {
    const expr = call("cos", sym("x"))
    expect(exprToMatraExprNode(expr)).toEqual({ head: "Call", attributes: {}, children: [{ head: "Symbol", attributes: { name: "cos" }, children: [] }, { head: "Symbol", attributes: { name: "x" }, children: [] }] })
  })

  test("TeX sin in complex expression", () => {
    expect(texToExpr("\\sin x + 1")).toEqual(plus(int(1n), call("sin", sym("x"))))
  })
})

describe("TeX I/O mock processing", () => {
  test("processMatrixTeX: simple passthrough", () => {
    const result = processMatrixTeX("x")
    expect(result).toBe("x")
  })

  test("processMatrixTeX: simple addition", () => {
    const result = processMatrixTeX("x + 1")
    expect(result).toBe("x + 1")
  })

  test("processMatrixTeX: multiplication", () => {
    const result = processMatrixTeX("2x")
    expect(result).toBe("2 x")
  })

  test("processMatrixTeX: power expression", () => {
    const result = processMatrixTeX("x^2")
    expect(result).toBe("x^{2}")
  })

  test("processMatrixTeX: sin function conventional mode", () => {
    const result = processMatrixTeX("\\sin x", "conventional")
    expect(result).toBe("\\sin x")
  })

  test("processMatrixTeX: sin function consistent mode", () => {
    const result = processMatrixTeX("\\sin x", "consistent")
    expect(result).toBe("\\sin(x)")
  })

  test("processMatrixTeX: cos function", () => {
    const result = processMatrixTeX("\\cos(x)")
    expect(result).toMatch(/\\cos/)
  })

  test("processMatrixTeX: complex expression", () => {
    const result = processMatrixTeX("2x + 1")
    expect(result).toBe("2 x + 1")
  })

  test("processMatrixTeX: fraction", () => {
    const result = processMatrixTeX("\\frac{1}{2}")
    expect(result).toBe("\\frac{1}{2}")
  })

  test("processBatchTeX: multiple expressions", () => {
    const results = processBatchTeX(["x", "y", "x + y"])
    expect(results.length).toBe(3)
    expect(results[0]).toBe("x")
    expect(results[1]).toBe("y")
    expect(results[2]).toBe("x + y")
  })

  test("processBatchTeX: error handling", () => {
    const results = processBatchTeX(["x", "invalid syntax @#$", "y"])
    expect(results.length).toBe(3)
    expect(results[1]).toBe("invalid syntax @#$") // returns input on error
  })

  test("processMatrixTeX: error handling returns input", () => {
    const input = "invalid @#$"
    const result = processMatrixTeX(input)
    expect(result).toBe(input)
  })

  test("processMatrixTeX: pi constant", () => {
    const result = processMatrixTeX("\\pi")
    expect(result).toBe("\\pi")
  })
})
