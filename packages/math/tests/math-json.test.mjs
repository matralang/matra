import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { astToMathJson, mathJsonToAST, parseMath } from "../dist/index.js"

describe("Matra MathJSON bridge", () => {
  it("parses Matra functions through @matra/core", () => {
    assert.deepEqual(parseMath("Add(1, Power(x, 2), -3)"), ["Add", 1, ["Power", "x", 2], -3])
  })
  it("unwraps the optional Formula document node", () => {
    assert.deepEqual(parseMath("Formula(Divide(1, 2))"), ["Divide", 1, 2])
  })
  it("rejects domain props instead of silently losing them", () => {
    assert.throws(() => parseMath('Add(axis="x", 1, 2)'), /cannot have Matra props/)
  })
  it("round-trips nested MathJSON through the Core AST", () => {
    const expression = ["Add", ["Power", "x", 2], -1]
    assert.deepEqual(astToMathJson(mathJsonToAST(expression)), expression)
  })
  it("represents a MathJSON symbol as a leaf node", () => {
    assert.deepEqual(mathJsonToAST("Pi"), { tag: "Pi", props: {}, children: [] })
  })
})
