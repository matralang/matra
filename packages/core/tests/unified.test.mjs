import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { EvaluationRequiredError, evaluateStatic, evaluateUnified, parse, parseUnified } from "../dist/index.js"

describe("unified Matra parser", () => {
  it("uses the unified grammar through the default parser", () => {
    assert.deepEqual(parse('p { "Hello" }'), parseUnified('p { "Hello" }'))
  })

  it("keeps node construction distinct from calls and member access", () => {
    const module = parseUnified('heading("Title")\nheading.title { "Title" }\ninvoice.title')
    assert.equal(module.statements[0].expression.kind, "call")
    assert.deepEqual(module.statements[1].expression, {
      kind: "node", tag: "heading", classes: ["title"], attributes: [],
      body: [{ kind: "expression", expression: { kind: "literal", value: "Title" } }],
    })
    assert.equal(module.statements[2].expression.kind, "member")
  })

  it("parses static data, attributes, and static lets", () => {
    const module = parseUnified(`let title = "Matra"
article.card.card(lang="ja", options={theme: "dark"}) {
  h1 { title }
}`)
    assert.deepEqual(evaluateStatic(module), {
      tag: "article",
      props: { lang: "ja", options: { theme: "dark" }, class: "card" },
      children: [{ tag: "h1", props: {}, children: ["Matra"] }],
    })
  })

  it("does not execute calls or unresolved references during static evaluation", () => {
    assert.throws(() => evaluateStatic(parseUnified("format_price(total)")), EvaluationRequiredError)
  })

  it("requires an explicit separator between body expressions", () => {
    assert.throws(() => parseUnified('p { "one" "two" }'), /newline or ';'/)
  })

  it("parses control and function declarations without syntax fallback", () => {
    const module = parseUnified('fn pick(value) { if (value) { return value } else { return "none" } }\nfor (item in items) { p { item } }')
    assert.equal(module.statements[0].kind, "fn")
    assert.equal(module.statements[1].kind, "for")
  })

  it("evaluates functions, conditions, and loops into document children", () => {
    const module = parseUnified('fn label(value) { return value }\nlet items = ["one", "two"]\nul { for (item in items) { if (item) { li { label(item) } } } }')
    assert.deepEqual(evaluateUnified(module), {
      tag: "ul", props: {}, children: [
        { tag: "li", props: {}, children: ["one"] },
        { tag: "li", props: {}, children: ["two"] },
      ],
    })
  })

  it("evaluates arithmetic and comparison operators by precedence", () => {
    assert.equal(evaluateUnified(parseUnified("1 + 2 * 3 == 7")), true)
    assert.equal(evaluateUnified(parseUnified("5 - 2 == 3")), true)
    assert.equal(evaluateUnified(parseUnified("-2 + 3 == 1")), true)
  })

  it("evaluates logical operators with unary negation", () => {
    assert.equal(evaluateUnified(parseUnified("!(false || false) && true")), true)
  })
})
