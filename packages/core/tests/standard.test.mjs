import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  evaluatePropExpressions,
  evaluateStandard,
  evaluateStandardProps,
  Map,
  Range,
} from "../dist/index.js"

const call = (tag, ...children) => ({ tag, props: {}, children })

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
    assert.deepEqual(evaluateStandard(call("Range", 3)), [1, 2, 3])
    assert.deepEqual(
      evaluateStandard(call("Map", "square", call("Range", 1, 4)), { functions }),
      [1, 4, 9, 16],
    )
  })

  it("reports unresolved Map functions", () => {
    assert.throws(
      () => evaluateStandard(call("Map", "missing", call("Range", 3))),
      /Unknown Map function: missing/,
    )
  })

  it("maps a scalar Lambda with explicit variable references", () => {
    const functions = {
      multiply: (left, right) => Number(left) * Number(right),
    }
    assert.deepEqual(
      evaluateStandard(
        call("Map", call("Lambda", "n", call("multiply", call("Var", "n"), call("Var", "n"))), call("Range", 1, 4)),
        { functions },
      ),
      [1, 4, 9, 16],
    )
  })

  it("captures outer Lambda variables in nested maps", () => {
    const functions = { pair: (left, right) => [left, right] }
    assert.deepEqual(
      evaluateStandard(
        call("Map", call("Lambda", "n", call("Map", call("Lambda", "m", call("pair", call("Var", "n"), call("Var", "m"))), call("Range", 2))), call("Range", 2)),
        { functions },
      ),
      [
        [[1, 1], [1, 2]],
        [[2, 1], [2, 2]],
      ],
    )
  })

  it("reports invalid Lambda use and unresolved variables", () => {
    assert.throws(
      () => evaluateStandard(call("Lambda", "n", call("Var", "n"))),
      /only valid where a function is expected/,
    )
    assert.throws(
      () => evaluateStandard(call("Map", call("Lambda", "n", call("Var", "m")), call("Range", 1))),
      /Unknown standard variable: m/,
    )
  })

  it("evaluates expressions embedded in props", () => {
    const ast = { tag: "circle", props: { cx: call("double", 4), fill: "red" }, children: [] }
    assert.deepEqual(
      evaluateStandardProps(ast, { functions: { double: value => Number(value) * 2 } }),
      { tag: "circle", props: { cx: 8, fill: "red" }, children: [] },
    )

    assert.deepEqual(
      evaluatePropExpressions({ tag: "g", props: {}, children: [{ tag: "circle", props: { cx: call("value") }, children: [] }] }, () => 12),
      {
        tag: "g",
        props: {},
        children: [{ tag: "circle", props: { cx: 12 }, children: [] }],
      },
    )
  })
})
