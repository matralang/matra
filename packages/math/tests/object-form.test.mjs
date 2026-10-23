import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { toMathJson } from "../dist/index.js"

describe("Matra Object Form", () => {
  it("converts complex literals", () => {
    assert.deepEqual(toMathJson({ re: 3, im: 4 }), ["Complex", 3, 4])
  })

  it("converts elementary functions", () => {
    assert.deepEqual(toMathJson({ sin: 0 }), ["Sin", 0])
  })

  it("applies operation layers in canonical order", () => {
    assert.deepEqual(toMathJson({ base: "x", power: 2, times: 3, plus: 1 }), [
      "Add",
      ["Multiply", ["Power", "x", 2], 3],
      1,
    ])
  })

  it("accepts operation lists", () => {
    assert.deepEqual(toMathJson({ base: 1, plus: [2, 3] }), ["Add", 1, 2, 3])
  })

  it("normalizes nested Object Form inside MathJSON", () => {
    assert.deepEqual(toMathJson(["Add", 1, { sin: "x" }]), ["Add", 1, ["Sin", "x"]])
  })

  it("combines power and root before multiplication and addition", () => {
    assert.deepEqual(toMathJson({ base: 1, plus: 2, times: 3, power: 4, root: 5 }), [
      "Add",
      ["Multiply", ["Power", 1, ["Divide", 4, 5]], 3],
      2,
    ])
  })

  it("converts nested Object Form recursively", () => {
    assert.deepEqual(toMathJson({ base: { base: 1, plus: { base: 5, root: 2 } }, divide: 2 }), [
      "Divide",
      ["Add", 1, ["Power", 5, ["Divide", 1, 2]]],
      2,
    ])
  })

  it("rejects empty objects and multiple seeds", () => {
    assert.throws(() => toMathJson({}), /cannot be empty/)
    assert.throws(() => toMathJson({ base: "x", sin: "x" }), /more than one seed/)
  })

  it("rejects unknown keys and operation layers without seeds", () => {
    assert.throws(() => toMathJson({ foo: "x" }), /Unknown Matra Object Form key: foo/)
    assert.throws(() => toMathJson({ power: 2 }), /power or root requires a seed/)
  })
})
