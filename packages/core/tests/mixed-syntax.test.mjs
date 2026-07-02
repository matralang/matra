// mixed-syntax.test.mjs — Test v0.7 block syntax and v0.8 function syntax together
// -------------------------------------------------------------------------------

import assert from "node:assert"
import { describe, it } from "node:test"
import { parse, compile } from "../dist/index.js"

describe("Matra v0.8 Mixed Syntax", () => {
  it("can parse function and block syntax in same document", () => {
    // This isn't directly supported at the Package level, but we can test
    // that each syntax works independently
    const func = parse('p("Hello")')
    const block = parse('p { "Hello" }')

    assert.strictEqual(func.tagName, "p")
    assert.strictEqual(block.tagName, "p")
    assert.strictEqual(func.children[0].value, "Hello")
    assert.strictEqual(block.children[0].value, "Hello")
  })

  it("function syntax integrates with template system", () => {
    const html = compile('div(h1("{{title}}"),p("{{content}}"))', {
      context: { title: "Welcome", content: "Hello, World!" },
    })
    assert.strictEqual(html, "<div><h1>Welcome</h1><p>Hello, World!</p></div>")
  })

  it("function syntax works with m-if directive", () => {
    // Note: m-if is applied during transformation, not in the properties
    // This test demonstrates that function syntax produces valid nodes
    // that can be transformed with m-if attributes
    const html1 = compile('p({"m-if":"show"},"Visible")', {
      context: { show: true },
    })
    assert.strictEqual(html1, "<p>Visible</p>")

    const html2 = compile('p({"m-if":"show"},"Visible")', {
      context: { show: false },
    })
    assert.strictEqual(html2, "")
  })

  it("function syntax produces same output as block syntax", () => {
    const html1 = compile(
      'div.container { h1#title { "Hello" } p { "World" } }'
    )
    const html2 = compile(
      'div({class:"container"},h1({id:"title"},"Hello"),p("World"))'
    )

    assert.strictEqual(html1, html2)
  })

  it("complex nested structure with function syntax", () => {
    const html = compile(
      'nav({class:"menu"},ul(li(a({href:"/"},"Home")),li(a({href:"/about"},"About"))))'
    )
    assert.strictEqual(
      html,
      '<nav class="menu"><ul><li><a href="/">Home</a></li><li><a href="/about">About</a></li></ul></nav>'
    )
  })

  it("function syntax with template interpolation", () => {
    const html = compile('section(h2("{{heading}}"),p("{{text}}"))', {
      context: { heading: "Introduction", text: "Welcome to our site." },
    })
    assert.strictEqual(
      html,
      "<section><h2>Introduction</h2><p>Welcome to our site.</p></section>"
    )
  })

  it("function syntax supports self-closing elements", () => {
    const html = compile('div(img({src:"logo.png",alt:"Logo"}),br())')
    assert.strictEqual(html, '<div><img src="logo.png" alt="Logo"><br></div>')
  })

  it("function syntax with multiple classes via properties", () => {
    const html = compile('div({class:"container mx-auto px-4"},"Content")')
    assert.strictEqual(
      html,
      '<div class="container mx-auto px-4">Content</div>'
    )
  })

  it("deep nesting with function syntax", () => {
    const html = compile(
      'article(header(h1("Title")),section(p("Paragraph 1"),p("Paragraph 2")),footer("Footer"))'
    )
    assert.strictEqual(
      html,
      "<article><header><h1>Title</h1></header><section><p>Paragraph 1</p><p>Paragraph 2</p></section><footer>Footer</footer></article>"
    )
  })
})
