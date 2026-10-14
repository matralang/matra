import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  evaluate,
  evaluateContentMathML,
  evaluateMatra,
  numericEvaluateMatra,
  numericEvaluateProps,
  simplifyMatra,
} from "../dist/index.js"

const call = (tag, ...children) => ({ tag, props: {}, children })

describe("Cortex Compute Engine adapter", () => {
  it("evaluates MathJSON without going through the Matra parser", () => {
    assert.equal(evaluate(["Add", 1, 2, 3]), 6)
  })

  it("evaluates Content MathML and returns the CD-aware semantic form", () => {
    assert.deepEqual(
      evaluateContentMathML('<math xmlns="http://www.w3.org/1998/Math/MathML"><apply><plus/><cn>1</cn><cn>2</cn></apply></math>'),
      { kind: "number", type: "integer", value: "3" },
    )
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

  it("evaluates math expressions embedded in props", () => {
    assert.deepEqual(
      numericEvaluateProps({ tag: "circle", props: { cx: call("Cos", "theta"), r: call("Divide", 3, 8) }, children: [] }, {
        theta: ["Divide", "Pi", 3],
      }),
      {
        tag: "circle",
        props: {
          cx: 0.5,
          r: 0.375,
        },
        children: [],
      },
    )
  })

  it("falls back to approximation when an exact expression is not scalar", () => {
    assert.deepEqual(
      numericEvaluateProps({ tag: "circle", props: { cx: call("Sqrt", 4), cy: call("Sqrt", 3) }, children: [] }),
      {
        tag: "circle",
        props: { cx: 2, cy: "1.73205080756887729353" },
        children: [],
      },
    )
  })
})
