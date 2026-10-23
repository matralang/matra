import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { evaluate, evaluateContentMathML, evaluateMatra, listStandardMathCommands, numericEvaluateMatra, numericEvaluateProps, morphionize, simplifyMatra } from "../dist/index.js"

const call = (tag, ...children) => ({ tag, props: {}, children })

describe("Cortex Compute Engine adapter", () => {
  it("lists callable symbols from the installed Compute Engine standard library", () => {
    const commands = new Map(listStandardMathCommands().map(command => [command.name, command]))
    assert.equal(commands.get("Sin").kind, "function")
    assert.equal(commands.get("Factorial").kind, "function")
    assert.equal(commands.get("Complex").kind, "function")
    assert.equal(commands.get("Pi").kind, "constant")
    assert.ok(commands.get("Add").properties.includes("associative"))
    assert.ok(commands.get("Add").properties.includes("commutative"))
    assert.ok(commands.get("Add").wikidata)
    assert.ok(commands.has("Mandelbrot"))
    assert.ok(commands.size > 300)
  })

  it("normalizes polynomial terms over symbol and function-call bases", () => {
    assert.deepEqual(morphionize(["Multiply", ["Add", "x", 1], ["Add", "x", 2]]), {
      head: "MorphionForm",
      attributes: {
        bases: ["x"],
        terms: [
          { key: [2], coeff: 1 },
          { key: [1], coeff: 3 },
          { key: [0], coeff: 2 },
        ],
      },
    })
    assert.deepEqual(morphionize(["Add", ["Sin", "x"], ["Cos", "x"]]), {
      head: "MorphionForm",
      attributes: {
        bases: [
          ["Cos", "x"],
          ["Sin", "x"],
        ],
        terms: [
          { key: [1, 0], coeff: 1 },
          { key: [0, 1], coeff: 1 },
        ],
      },
    })
  })

  it("converts complex numbers into real and imaginary Morphion terms", () => {
    assert.deepEqual(morphionize(["Complex", 1, 2]), {
      head: "MorphionForm",
      attributes: {
        bases: ["ImaginaryUnit"],
        terms: [
          { key: [1], coeff: 2 },
          { key: [0], coeff: 1 },
        ],
      },
    })
  })

  it("keeps negative powers, non-integer powers, and non-monomial division well-defined", () => {
    assert.deepEqual(morphionize(["Divide", 1, "x"]).attributes, {
      bases: ["x"],
      terms: [{ key: [-1], coeff: 1 }],
    })
    assert.deepEqual(morphionize(["Power", "x", ["Rational", 1, 2]]).attributes, {
      bases: [["Power", "x", ["Rational", 1, 2]]],
      terms: [{ key: [1], coeff: 1 }],
    })
    assert.deepEqual(morphionize(["Divide", 1, ["Add", "x", 1]]).attributes, {
      bases: [["Divide", 1, ["Add", "x", 1]]],
      terms: [{ key: [1], coeff: 1 }],
    })
    assert.deepEqual(morphionize(["Divide", 1, 1.5]).attributes, {
      bases: [],
      terms: [{ key: [], coeff: ["Rational", 2, 3] }],
    })
  })

  it("rejects Morphion expansion beyond the configured term limit", () => {
    const sumOfBases = ["Add", ...Array.from({ length: 24 }, (_, index) => `x${index}`)]
    assert.throws(() => morphionize(["Power", sumOfBases, 2]), /Morphion expansion exceeds 256 terms/)
  })

  it("evaluates MathJSON without going through the Matra parser", () => {
    assert.equal(evaluate(["Add", 1, 2, 3]), 6)
  })

  it("evaluates Content MathML and returns the CD-aware semantic form", () => {
    assert.deepEqual(evaluateContentMathML('<math xmlns="http://www.w3.org/1998/Math/MathML"><apply><plus/><cn>1</cn><cn>2</cn></apply></math>'), { kind: "number", type: "integer", value: "3" })
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
    assert.equal(numericEvaluateMatra("Add(Power(x, 2), y)", { x: 3, y: 4 }), 13)
  })

  it("evaluates math expressions embedded in props", () => {
    assert.deepEqual(
      numericEvaluateProps(
        { tag: "circle", props: { cx: call("Cos", "theta"), r: call("Divide", 3, 8) }, children: [] },
        {
          theta: ["Divide", "Pi", 3],
        },
      ),
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
    assert.deepEqual(numericEvaluateProps({ tag: "circle", props: { cx: call("Sqrt", 4), cy: call("Sqrt", 3) }, children: [] }), {
      tag: "circle",
      props: { cx: 2, cy: "1.73205080756887729353" },
      children: [],
    })
  })
})
