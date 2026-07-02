/// <reference types="jest" />
import { astToTeX } from "../src/ast-to-tex"
import type { MatraNode } from "../src/ast-to-tex"

describe("astToTeX", () => {
  test("Const: Pi, E, 数字", () => {
    expect(astToTeX({ head: "Const", attributes: {}, children: ["Pi"] })).toBe("\\pi")
    expect(astToTeX({ head: "Const", attributes: {}, children: ["E"] })).toBe("e")
    expect(astToTeX({ head: "Const", attributes: {}, children: ["42"] })).toBe("42")
  })

  test("Var", () => {
    expect(astToTeX({ head: "Var", attributes: {}, children: ["x"] })).toBe("x")
    expect(astToTeX({ head: "Var", attributes: {}, children: ["alpha"] })).toBe("alpha")
  })

  test("Add", () => {
    const ast: MatraNode = {
      head: "Add",
      attributes: {},
      children: [
        { head: "Var", attributes: {}, children: ["x"] },
        { head: "Const", attributes: {}, children: ["1"] },
      ],
    }
    expect(astToTeX(ast)).toBe("x + 1")
  })

  test("Mul: consistent vs conventional", () => {
    const ast: MatraNode = {
      head: "Mul",
      attributes: {},
      children: [
        { head: "Const", attributes: {}, children: ["2"] },
        { head: "Var", attributes: {}, children: ["x"] },
      ],
    }
    expect(astToTeX(ast, "consistent")).toBe("2 \\cdot x")
    expect(astToTeX(ast, "conventional")).toBe("2 x")
  })

  test("Div", () => {
    const ast: MatraNode = {
      head: "Div",
      attributes: {},
      children: [
        { head: "Const", attributes: {}, children: ["1"] },
        { head: "Const", attributes: {}, children: ["2"] },
      ],
    }
    expect(astToTeX(ast)).toBe("\\frac{1}{2}")
  })

  test("Pow", () => {
    const ast: MatraNode = {
      head: "Pow",
      attributes: {},
      children: [
        { head: "Var", attributes: {}, children: ["y"] },
        { head: "Const", attributes: {}, children: ["2"] },
      ],
    }
    expect(astToTeX(ast)).toBe("y^{2}")
  })

  test("Call: f(x)", () => {
    const ast: MatraNode = {
      head: "Call",
      attributes: {},
      children: [
        { head: "Var", attributes: {}, children: ["f"] },
        { head: "Var", attributes: {}, children: ["x"] },
      ],
    }
    expect(astToTeX(ast)).toBe("f(x)")
  })

  test("Sin / Cos: consistent vs conventional", () => {
    const sinAst: MatraNode = { head: "Sin", attributes: {}, children: [{ head: "Var", attributes: {}, children: ["x"] }] }
    const cosAst: MatraNode = { head: "Cos", attributes: {}, children: [{ head: "Var", attributes: {}, children: ["x"] }] }

    expect(astToTeX(sinAst, "consistent")).toBe("\\sin(x)")
    expect(astToTeX(sinAst, "conventional")).toBe("\\sin x")

    expect(astToTeX(cosAst, "consistent")).toBe("\\cos(x)")
    expect(astToTeX(cosAst, "conventional")).toBe("\\cos x")
  })

  test("複合式: 2x + y^2", () => {
    const ast: MatraNode = {
      head: "Add",
      attributes: {},
      children: [
        {
          head: "Mul",
          attributes: {},
          children: [
            { head: "Const", attributes: {}, children: ["2"] },
            { head: "Var", attributes: {}, children: ["x"] },
          ],
        },
        {
          head: "Pow",
          attributes: {},
          children: [
            { head: "Var", attributes: {}, children: ["y"] },
            { head: "Const", attributes: {}, children: ["2"] },
          ],
        },
      ],
    }
    expect(astToTeX(ast, "consistent")).toBe("2 \\cdot x + y^{2}")
    expect(astToTeX(ast, "conventional")).toBe("2 x + y^{2}")
  })

  test("ネスト: (1 + x) / (1 - x)", () => {
    const ast: MatraNode = {
      head: "Div",
      attributes: {},
      children: [
        {
          head: "Add",
          attributes: {},
          children: [
            { head: "Const", attributes: {}, children: ["1"] },
            { head: "Var", attributes: {}, children: ["x"] },
          ],
        },
        {
          head: "Add",
          attributes: {},
          children: [
            { head: "Const", attributes: {}, children: ["1"] },
            {
              head: "Mul",
              attributes: {},
              children: [
                { head: "Const", attributes: {}, children: ["-1"] },
                { head: "Var", attributes: {}, children: ["x"] },
              ],
            },
          ],
        },
      ],
    }
    expect(astToTeX(ast)).toBe("\\frac{1 + x}{1-x}")
  })
})
