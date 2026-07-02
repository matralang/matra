import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parse, parseWith } from "../dist/index.js"

describe("Matra parser", () => {
  it("parses function syntax and preserves literal types", () => {
    assert.deepEqual(parse('sum(value("a"), -2, ratio=.5, missing=null)'), {
      tag: "sum",
      props: { ratio: 0.5, missing: null },
      children: [{ tag: "value", props: {}, children: ["a"] }, -2],
    })
  })

  it("parses document syntax", () => {
    assert.deepEqual(parse('article.card#main[lang="en"] { h1`Title` }'), {
      tag: "article",
      props: { lang: "en", id: "main", class: "card" },
      children: [{ tag: "h1", props: {}, children: ["Title"] }],
    })
  })

  it("enforces syntax modes", () => {
    assert.throws(
      () => parse('p("Hello")', { syntaxMode: "document" }),
      /Function syntax is not allowed/,
    )
    assert.throws(
      () => parse('p`Hello`', { syntaxMode: "application" }),
      /Block syntax is not allowed/,
    )
  })

  it("rejects duplicate properties", () => {
    assert.throws(() => parse('circle(x=1, x=2)'), /Duplicate prop: x/)
  })

  it("normalizes replaceable parser output", () => {
    const parser = { parse: () => ["doc", {}, ["Hello"]] }
    assert.deepEqual(parseWith(parser, "ignored"), {
      tag: "doc",
      props: {},
      children: ["Hello"],
    })
  })
})
