/// <reference types="jest" />
import { texToAst } from "../src/tex-to-ast"

describe("texToAst", () => {
  test("Const: Pi, E, 数字", () => {
    expect(texToAst("\\pi")).toEqual({ head: "Const", attributes: {}, children: ["Pi"] })
    expect(texToAst("e")).toEqual({ head: "Const", attributes: {}, children: ["E"] })
    expect(texToAst("42")).toEqual({ head: "Const", attributes: {}, children: ["42"] })
  })

  test("Var", () => {
    expect(texToAst("x")).toEqual({ head: "Var", attributes: {}, children: ["x"] })
    expect(texToAst("alpha")).toEqual({ head: "Var", attributes: {}, children: ["alpha"] })
  })

  test("Add", () => {
    expect(texToAst("x + 1")).toEqual({ head: "Add", attributes: {}, children: [
      { head: "Var", attributes: {}, children: ["x"] },
      { head: "Const", attributes: {}, children: ["1"] },
    ] })
  })

  test("Mul: conventional (暗黙の掛け算)", () => {
    expect(texToAst("2x")).toEqual({ head: "Mul", attributes: {}, children: [
      { head: "Const", attributes: {}, children: ["2"] },
      { head: "Var", attributes: {}, children: ["x"] },
    ] })
  })

  test("Mul: consistent (明示的)", () => {
    expect(texToAst("2 \\cdot x")).toEqual({ head: "Mul", attributes: {}, children: [
      { head: "Const", attributes: {}, children: ["2"] },
      { head: "Var", attributes: {}, children: ["x"] },
    ] })
  })

  test("Div", () => {
    expect(texToAst("\\frac{1}{2}")).toEqual({ head: "Div", attributes: {}, children: [
      { head: "Const", attributes: {}, children: ["1"] },
      { head: "Const", attributes: {}, children: ["2"] },
    ] })
  })

  test("Pow", () => {
    expect(texToAst("y^{2}")).toEqual({ head: "Pow", attributes: {}, children: [
      { head: "Var", attributes: {}, children: ["y"] },
      { head: "Const", attributes: {}, children: ["2"] },
    ] })
  })

  test("Call: f(x)", () => {
    expect(texToAst("f(x)")).toEqual({ head: "Call", attributes: {}, children: [
      { head: "Var", attributes: {}, children: ["f"] },
      { head: "Var", attributes: {}, children: ["x"] },
    ] })
  })

  test("Sin / Cos: conventional", () => {
    expect(texToAst("\\sin x")).toEqual({ head: "Sin", attributes: {}, children: [
      { head: "Var", attributes: {}, children: ["x"] },
    ] })
    expect(texToAst("\\cos x")).toEqual({ head: "Cos", attributes: {}, children: [
      { head: "Var", attributes: {}, children: ["x"] },
    ] })
  })

  test("Sin / Cos: consistent", () => {
    expect(texToAst("\\sin(x)")).toEqual({ head: "Sin", attributes: {}, children: [
      { head: "Var", attributes: {}, children: ["x"] },
    ] })
    expect(texToAst("\\cos(x)")).toEqual({ head: "Cos", attributes: {}, children: [
      { head: "Var", attributes: {}, children: ["x"] },
    ] })
  })

  test("複合式: 2x + y^2", () => {
    expect(texToAst("2x + y^{2}")).toEqual({ head: "Add", attributes: {}, children: [
      { head: "Mul", attributes: {}, children: [
        { head: "Const", attributes: {}, children: ["2"] },
        { head: "Var", attributes: {}, children: ["x"] },
      ] },
      { head: "Pow", attributes: {}, children: [
        { head: "Var", attributes: {}, children: ["y"] },
        { head: "Const", attributes: {}, children: ["2"] },
      ] },
    ] })
  })

  test("ネスト: (1 + x) / (1 - x)", () => {
    expect(texToAst("\\frac{1+x}{1-x}")).toEqual({ head: "Div", attributes: {}, children: [
      { head: "Add", attributes: {}, children: [
        { head: "Const", attributes: {}, children: ["1"] },
        { head: "Var", attributes: {}, children: ["x"] },
      ] },
      { head: "Add", attributes: {}, children: [
        { head: "Const", attributes: {}, children: ["1"] },
        { head: "Mul", attributes: {}, children: [
          { head: "Const", attributes: {}, children: ["-1"] },
          { head: "Var", attributes: {}, children: ["x"] },
        ] },
      ] },
    ] })
  })
})
