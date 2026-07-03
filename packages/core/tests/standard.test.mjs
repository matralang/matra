import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  evaluatePropExpressions,
  evaluateStandard,
  evaluateStandardProps,
  Map,
  parse,
  Range,
} from "../dist/index.js"

describe("Matra standard collection functions", () => {
  it("creates inclusive ranges", () => {
    assert.deepEqual(Range(4), [1, 2, 3, 4])
    assert.deepEqual(Range(2, 5), [2, 3, 4, 5])
    assert.deepEqual(Range(5, 1, -2), [5, 3, 1])
    assert.deepEqual(Range(5, 1), [])
    assert.deepEqual(Range(0, 0.3, 0.1), [0, 0.1, 0.2, 0.30000000000000004])
  })

  it("rejects invalid ranges", () => {
    assert.throws(() => Range(1, 2, 0), /must not be zero/)
    assert.throws(() => Range(1, Infinity), /must be finite/)
    assert.deepEqual(Range(1, 3, -1), [])
  })

  it("maps a function over values", () => {
    assert.deepEqual(Map(value => Number(value) * 2, [1, 2, 3]), [2, 4, 6])
  })

  it("evaluates Range and Map from Matra application syntax", () => {
    const functions = { square: value => Number(value) ** 2 }
    assert.deepEqual(evaluateStandard(parse("Range(3)")), [1, 2, 3])
    assert.deepEqual(
      evaluateStandard(parse("Map(square, Range(1, 4))"), { functions }),
      [1, 4, 9, 16],
    )
  })

  it("reports unresolved Map functions", () => {
    assert.throws(
      () => evaluateStandard(parse("Map(missing, Range(3))")),
      /Unknown Map function: missing/,
    )
  })

  it("evaluates expressions embedded in props", () => {
    const ast = parse("circle(cx=double(4), fill=red)")
    assert.deepEqual(
      evaluateStandardProps(ast, { functions: { double: value => Number(value) * 2 } }),
      { tag: "circle", props: { cx: 8, fill: "red" }, children: [] },
    )

    assert.deepEqual(
      evaluatePropExpressions(parse("g(circle(cx=value()))"), () => 12),
      {
        tag: "g",
        props: {},
        children: [{ tag: "circle", props: { cx: 12 }, children: [] }],
      },
    )
  })
})
