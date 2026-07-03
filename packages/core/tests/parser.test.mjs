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

  it("distinguishes member access from dotted node construction", () => {
    assert.deepEqual(parse("foo"), {
      tag: "$var",
      props: { name: "foo" },
      children: [],
    })
    assert.deepEqual(parse("foo.bar"), {
      tag: "$get",
      props: { path: ["foo", "bar"] },
      children: [],
    })
    assert.deepEqual(parse("foo.bar.baz"), {
      tag: "$get",
      props: { path: ["foo", "bar", "baz"] },
      children: [],
    })
    assert.deepEqual(parse("foo.bar.baz;"), {
      tag: "foo",
      props: { class: "bar baz" },
      children: [],
    })
  })

  it("constructs empty nodes with selectors and attributes", () => {
    assert.deepEqual(parse('foo.bar#main[x="1"];'), {
      tag: "foo",
      props: { x: "1", id: "main", class: "bar" },
      children: [],
    })
    assert.deepEqual(parse("expr;"), { tag: "expr", props: {}, children: [] })
    assert.deepEqual(parse("a;"), { tag: "a", props: {}, children: [] })
    assert.deepEqual(parse("foo.bar { baz.qux; }"), {
      tag: "foo",
      props: { class: "bar" },
      children: [{ tag: "baz", props: { class: "qux" }, children: [] }],
    })
  })

  it("parses explicit expressions, including inside document bodies", () => {
    assert.deepEqual(parse("= expr"), {
      tag: "$var",
      props: { name: "expr" },
      children: [],
    })
    assert.deepEqual(parse("output {= user.profile.name }"), {
      tag: "output",
      props: {},
      children: [{
        tag: "$get",
        props: { path: ["user", "profile", "name"] },
        children: [],
      }],
    })
  })

  it("parses qualified calls before member expressions", () => {
    assert.deepEqual(parse('foo.bar("x")'), {
      tag: "foo.bar",
      props: {},
      children: ["x"],
    })
    assert.deepEqual(parse("consume(foo.bar)"), {
      tag: "consume",
      props: {},
      children: [{
        tag: "$get",
        props: { path: ["foo", "bar"] },
        children: [],
      }],
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
    assert.throws(
      () => parse("foo.bar", { syntaxMode: "document" }),
      /Expression syntax is not allowed/,
    )
    assert.throws(
      () => parse("foo.bar;", { syntaxMode: "application" }),
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
