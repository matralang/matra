/// <reference types="jest" />
import {
  evaluateMatra,
  numericEvaluateMatra,
  parseMatraMathJson,
  simplifyMatra,
} from "../src/matra-math-json"

describe("Matra MathJSON bridge", () => {
  test("converts Matra function syntax to MathJSON", () => {
    expect(parseMatraMathJson("Add(1, 2, 3)")).toEqual(["Add", 1, 2, 3])
    expect(parseMatraMathJson("Power(x, 2)")).toEqual(["Power", "x", 2])
  })

  test("evaluates MathJSON with Compute Engine", () => {
    expect(evaluateMatra("Add(1, 2, 3)")).toBe(6)
    expect(evaluateMatra("Multiply(4, Add(1, 2))")).toBe(12)
    expect(evaluateMatra("Subtract(10, 3)")).toBe(7)
    expect(evaluateMatra("Power(2, 10)")).toBe(1024)
    expect(evaluateMatra("Sqrt(81)")).toBe(9)
    expect(evaluateMatra("Sin(Divide(Pi, 2))")).toBe(1)
    expect(evaluateMatra("Log(100, 10)")).toBe(2)
    expect(evaluateMatra("Factorial(5)")).toBe(120)
    expect(evaluateMatra("Abs(-7)")).toBe(7)
    expect(evaluateMatra("Equal(2, 2)")).toBe("True")
  })

  test("supports symbolic simplification and numeric approximation", () => {
    expect(simplifyMatra("Add(x, x)")).toEqual(["Multiply", 2, "x"])
    expect(simplifyMatra("Divide(1, 2)")).toEqual(["Rational", 1, 2])
    expect(numericEvaluateMatra("Divide(1, 2)")).toBe(0.5)
  })
})
