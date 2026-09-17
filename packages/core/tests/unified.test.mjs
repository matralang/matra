import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { EvaluationRequiredError, evaluateStatic, parse, parseUnified } from "../dist/index.js"

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
})
