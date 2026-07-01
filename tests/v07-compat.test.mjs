// v07-compat.test.mjs — Verify v0.7 syntax still works in v0.8
// ----------------------------------------------------------------

import assert from "node:assert"
import { describe, it } from "node:test"
import { parse, compile } from "../dist/index.js"

describe("Matra v0.7 Compatibility", () => {
  it("parses simple element with text", () => {
    const src = 'p { "Hello" }'
    const ast = parse(src)
    assert.strictEqual(ast.type, "element")
    assert.strictEqual(ast.tagName, "p")
    assert.strictEqual(ast.children[0].type, "text")
    assert.strictEqual(ast.children[0].value, "Hello")
  })

  it("parses element with class", () => {
    const src = 'div.container { "Content" }'
    const ast = parse(src)
    assert.strictEqual(ast.type, "element")
    assert.strictEqual(ast.tagName, "div")
    assert.strictEqual(ast.properties.class, "container")
  })

  it("parses element with id", () => {
    const src = 'h1#title { "My Title" }'
    const ast = parse(src)
    assert.strictEqual(ast.type, "element")
    assert.strictEqual(ast.tagName, "h1")
    assert.strictEqual(ast.properties.id, "title")
  })

  it("parses element with attributes", () => {
    const src = 'a[href="/home" target="_blank"] { "Link" }'
    const ast = parse(src)
    assert.strictEqual(ast.type, "element")
    assert.strictEqual(ast.tagName, "a")
    assert.strictEqual(ast.properties.href, "/home")
    assert.strictEqual(ast.properties.target, "_blank")
  })

  it("parses nested elements", () => {
    const src = 'div { p { "Hello" } }'
    const ast = parse(src)
    assert.strictEqual(ast.type, "element")
    assert.strictEqual(ast.tagName, "div")
    assert.strictEqual(ast.children[0].type, "element")
    assert.strictEqual(ast.children[0].tagName, "p")
  })

  it("compiles to HTML", () => {
    const html = compile('div.greeting { h1 { "Hello, World!" } }')
    assert.strictEqual(
      html,
      '<div class="greeting"><h1>Hello, World!</h1></div>'
    )
  })

  it("supports mustache interpolation", () => {
    const html = compile('div { "Hello, {{name}}!" }', {
      context: { name: "Butchi" },
    })
    assert.strictEqual(html, "<div>Hello, Butchi!</div>")
  })

  it("supports m-if directive (attribute style)", () => {
    const html1 = compile('div[m-if="show"] { "Visible" }', {
      context: { show: true },
    })
    assert.strictEqual(html1, "<div>Visible</div>")

    const html2 = compile('div[m-if="show"] { "Visible" }', {
      context: { show: false },
    })
    assert.strictEqual(html2, "")
  })

  it("supports m-each directive", () => {
    const html = compile(
      'ul { li[m-each="items" m-as="item"] { "{{item}}" } }',
      {
        context: { items: ["A", "B", "C"] },
      }
    )
    assert.strictEqual(html, "<ul><li>A</li><li>B</li><li>C</li></ul>")
  })

  it("supports HTML elements", () => {
    const src = '<div class="test">Hello</div>'
    const ast = parse(src)
    assert.strictEqual(ast.type, "element")
    assert.strictEqual(ast.tagName, "div")
    assert.strictEqual(ast.properties.class, "test")
  })

  it("supports comments", () => {
    const src = "<!-- This is a comment -->"
    const ast = parse(src)
    assert.strictEqual(ast.type, "comment")
    assert.strictEqual(ast.value.trim(), "This is a comment")
  })
})
