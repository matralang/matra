import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { contentMathMLToMathJson, mathJsonToContentMathML, normalizeContentMathML, parseContentMathML, serializeContentMathML } from "../dist/index.js"

const math = expression => `<math xmlns="http://www.w3.org/1998/Math/MathML">${expression}</math>`

describe("Content MathML bridge", () => {
  it("rewrites operator elements into Strict Content MathML symbols", () => {
    assert.equal(normalizeContentMathML(math("<apply><plus/><ci>x</ci><cn type='integer'>2</cn></apply>")), math('<apply><csymbol cd="arith1">plus</csymbol><ci>x</ci><cn type="integer">2</cn></apply>'))
  })

  it("preserves unknown symbol identity in its tree and strict serialization", () => {
    const expression = parseContentMathML(math('<apply><csymbol cd="custom1">special</csymbol><ci>x</ci></apply>'))
    assert.deepEqual(expression, {
      kind: "application",
      operator: {
        kind: "symbol",
        cdbase: "http://www.openmath.org/cd",
        cd: "custom1",
        name: "special",
      },
      operands: [{ kind: "identifier", name: "x" }],
    })
    assert.equal(serializeContentMathML(expression), math('<apply><csymbol cd="custom1">special</csymbol><ci>x</ci></apply>'))
    assert.throws(() => contentMathMLToMathJson(expression), /Unsupported Content Dictionary symbol/)
  })

  it("rejects strict serialization when a custom cdbase cannot be represented", () => {
    const expression = {
      kind: "symbol",
      cdbase: "https://example.test/cd",
      cd: "custom1",
      name: "special",
    }
    assert.throws(() => serializeContentMathML(expression), /non-default cdbase/)
  })

  it("normalizes unary minus, roots, and rational numbers", () => {
    assert.equal(normalizeContentMathML(math("<apply><minus/><cn>3</cn></apply>")), math('<apply><csymbol cd="arith1">unary_minus</csymbol><cn type="real">3</cn></apply>'))
    assert.equal(normalizeContentMathML(math("<apply><root/><cn type='integer'>9</cn></apply>")), math('<apply><csymbol cd="arith1">root</csymbol><cn type="integer">9</cn><cn type="integer">2</cn></apply>'))
    assert.deepEqual(contentMathMLToMathJson(parseContentMathML(math("<cn type='rational'>3<sep/>4</cn>"))), ["Rational", 3, 4])
  })

  it("preserves MathML double special values but rejects them at the MathJSON boundary", () => {
    const expression = parseContentMathML(math('<cn type="double">INF</cn>'))
    assert.equal(serializeContentMathML(expression), math('<cn type="double">INF</cn>'))
    assert.throws(() => contentMathMLToMathJson(expression), /cannot be represented losslessly/)
  })

  it("maps supported CD identities to MathJSON engine names", () => {
    const expression = parseContentMathML(math("<apply><times/><apply><sin/><ci>x</ci></apply><pi/></apply>"))
    assert.deepEqual(contentMathMLToMathJson(expression), ["Multiply", ["Sin", "x"], "Pi"])
  })

  it("round-trips supported MathJSON through CD-aware expressions", () => {
    const expression = ["Add", ["Sin", "x"], "Pi"]
    assert.deepEqual(contentMathMLToMathJson(mathJsonToContentMathML(expression)), expression)
    assert.deepEqual(mathJsonToContentMathML(true), {
      kind: "symbol",
      cdbase: "http://www.openmath.org/cd",
      cd: "logic1",
      name: "true",
    })
  })

  it("rejects unsupported markup, malformed XML, invalid arity, and doctypes", () => {
    assert.throws(() => parseContentMathML(math("<apply><abs/><ci>x</ci><ci>y</ci></apply>")), /Invalid operand count/)
    assert.throws(() => parseContentMathML(math("<apply><power/><ci>x</ci></apply>")), /Invalid operand count/)
    assert.throws(() => parseContentMathML(math("<annotation>text</annotation>")), /Unsupported Content MathML element/)
    assert.throws(() => parseContentMathML(math("<ci cdbase='https://example.test/cd'>x</ci>")), /Unsupported attribute cdbase/)
    assert.throws(() => parseContentMathML('<math xmlns="http://www.w3.org/1998/Math/MathML" cdgroup="https://example.test/group"><ci>x</ci></math>'), /Unsupported attribute cdgroup/)
    assert.throws(() => parseContentMathML("<math>"), /Invalid Content MathML/)
    assert.throws(() => parseContentMathML('<!DOCTYPE math [<!ENTITY x "x">]><math xmlns="http://www.w3.org/1998/Math/MathML"><ci>&x;</ci></math>'), /doctype declarations/)
  })
})
