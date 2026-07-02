// syntax.test.mjs — Matra v0.5 syntax round-trip test
// ----------------------------------------------------
// run with:  node --test  (Node.js >=18)

import assert from "node:assert"
import { describe, it } from "node:test"
import { parse } from "../src/matra-parser.mjs"

describe("Matra v0.5 Syntax", () => {
  it("parses simple Matra node", () => {
    const src = 'p { "Hello" }'
    const ast = parse(src)
    assert.deepStrictEqual(ast, [["p", null, ["Hello"]]])
  })

  it("parses JSON anonymous node", () => {
    const src = "{ key: 1 }"
    const ast = parse(src)
    assert.deepStrictEqual(ast, [[{ key: 1 }]])
  })

  it("parses tagdef structure", () => {
    const src =
      "tagdef plot { domain: range, color: string, samples: int = 100 }"
    const ast = parse(src)
    assert.deepStrictEqual(ast, [
      [
        "tagdef",
        { name: "plot" },
        [
          { key: "domain", type: "range", default: null },
          { key: "color", type: "string", default: null },
          { key: "samples", type: "int", default: 100 },
        ],
      ],
    ])
  })

  it("parses Markdown heading", () => {
    const src = "# Title"
    const ast = parse(src)
    assert.deepStrictEqual(ast, [["h1", null, ["Title"]]])
  })

  it("parses code block (```js)", () => {
    const src = "```js\nlet a = 1;\n```"
    const ast = parse(src)
    assert.deepStrictEqual(ast, [["code", { fileType: "js" }, ["let a = 1;"]]])
  })

  it("parses tagged template literal (js`...`)", () => {
    const src = "js`f(x)`"
    const ast = parse(src)
    assert.deepStrictEqual(ast, [["code", { fileType: "js" }, ["f(x)"]]])
  })

  it("parses Markdown link [example](url)", () => {
    const src = "[example](https://example.com)"
    const ast = parse(src)
    assert.deepStrictEqual(ast, [
      ["a", { href: "https://example.com" }, ["example"]],
    ])
  })

  it("parses Markdown image ![alt](src)", () => {
    const src = "![cat](cat.png)"
    const ast = parse(src)
    assert.deepStrictEqual(ast, [["img", { alt: "cat", src: "cat.png" }]])
  })

  it("allows nested body elements", () => {
    const src = 'div { p { "Hello" } }'
    const ast = parse(src)
    assert.deepStrictEqual(ast, [["div", null, [["p", null, ["Hello"]]]]])
  })
})
