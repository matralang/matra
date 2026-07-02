import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  evaluate,
  evaluateMatra,
  numericEvaluateMatra,
  simplifyMatra,
} from "../dist/index.js"

describe("Cortex Compute Engine adapter", () => {
  it("evaluates MathJSON without going through the Matra parser", () => {
    assert.equal(evaluate(["Add", 1, 2, 3]), 6)
  })

  it("evaluates Matra syntax through @matra/math", () => {
    assert.equal(evaluateMatra("Multiply(4, Add(1, 2))"), 12)
    assert.equal(evaluateMatra("Abs(-7)"), 7)
  })

  it("simplifies symbolic Matra expressions", () => {
    assert.deepEqual(simplifyMatra("Add(x, x)"), ["Multiply", 2, "x"])
  })

  it("computes numeric approximations", () => {
    assert.equal(numericEvaluateMatra("Divide(1, 2)"), 0.5)
  })

  it("binds scoped values into Matra formulas", () => {
    assert.equal(
      numericEvaluateMatra("Add(Power(x, 2), y)", { x: 3, y: 4 }),
      13,
    )
  })
})
