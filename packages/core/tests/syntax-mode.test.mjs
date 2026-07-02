// syntax-mode.test.mjs — Syntax mode tests
// -----------------------------------------
// Tests for mode option: 'mixed', 'document', 'application'

import assert from "node:assert"
import { describe, it } from "node:test"
import { compile } from "../dist/index.js"

describe("Syntax Mode Options", () => {
  describe("Mixed Mode (default)", () => {
    it("accepts Block syntax", () => {
      const html = compile('div.container { p { "Hello" } }')
      assert.strictEqual(html, '<div class="container"><p>Hello</p></div>')
    })

    it("accepts Function syntax", () => {
      const html = compile('div({class:"container"}, p("Hello"))')
      assert.strictEqual(html, '<div class="container"><p>Hello</p></div>')
    })

    it("accepts mixed Block and Function syntax", () => {
      const html = compile('div.wrapper { p("Hello") }')
      assert.strictEqual(html, '<div class="wrapper"><p>Hello</p></div>')
    })

    it("works with explicit mode: 'mixed'", () => {
      const html = compile('div.box { p("Text") }', { mode: "mixed" })
      assert.strictEqual(html, '<div class="box"><p>Text</p></div>')
    })
  })

  describe("Document Mode", () => {
    it("accepts Block syntax with class selector", () => {
      const html = compile('div.container { "Content" }', { mode: "document" })
      assert.strictEqual(html, '<div class="container">Content</div>')
    })

    it("accepts Block syntax with id selector", () => {
      const html = compile('h1#title { "Title" }', { mode: "document" })
      assert.strictEqual(html, '<h1 id="title">Title</h1>')
    })

    it("accepts Block syntax with attributes", () => {
      const html = compile('a[href="/" target="_blank"] { "Link" }', {
        mode: "document",
      })
      assert.strictEqual(html, '<a href="/" target="_blank">Link</a>')
    })

    it("accepts complex Pug-style syntax", () => {
      const html = compile(
        `
        nav.main-nav {
          ul {
            li { a[href="/"] { "Home" } }
            li { a[href="/about"] { "About" } }
          }
        }
      `,
        { mode: "document" }
      )
      assert.ok(html.includes('<nav class="main-nav">'))
      assert.ok(html.includes('<a href="/">Home</a>'))
      assert.ok(html.includes('<a href="/about">About</a>'))
    })

    it("rejects Function syntax", () => {
      assert.throws(() => {
        compile('p("Hello")', { mode: "document" })
      }, /Function syntax is not allowed/)
    })

    it("rejects Function syntax with properties", () => {
      assert.throws(() => {
        compile('div({class:"box"}, "Content")', { mode: "document" })
      }, /Function syntax is not allowed/)
    })
  })

  describe("Application Mode", () => {
    it("accepts Function syntax", () => {
      const html = compile('p("Hello")', { mode: "application" })
      assert.strictEqual(html, "<p>Hello</p>")
    })

    it("accepts Function syntax with properties", () => {
      const html = compile('a({href:"/", class:"link"}, "Home")', {
        mode: "application",
      })
      assert.strictEqual(html, '<a href="/" class="link">Home</a>')
    })

    it("accepts nested Function syntax", () => {
      const html = compile('div(p("A"), p("B"))', { mode: "application" })
      assert.strictEqual(html, "<div><p>A</p><p>B</p></div>")
    })

    it("accepts complex JSX-style syntax", () => {
      const html = compile(
        `
        nav({class:"menu"},
          ul(
            li(a({href:"/"}, "Home")),
            li(a({href:"/about"}, "About"))
          )
        )
      `,
        { mode: "application" }
      )
      assert.ok(html.includes('<nav class="menu">'))
      assert.ok(html.includes('<a href="/">Home</a>'))
      assert.ok(html.includes('<a href="/about">About</a>'))
    })

    it("rejects Block syntax with class selector", () => {
      assert.throws(() => {
        compile('div.container { "Content" }', { mode: "application" })
      }, /Block syntax is not allowed/)
    })

    it("rejects Block syntax with id selector", () => {
      assert.throws(() => {
        compile('h1#title { "Title" }', { mode: "application" })
      }, /Block syntax is not allowed/)
    })

    it("rejects Block syntax with attributes", () => {
      assert.throws(() => {
        compile('a[href="/"] { "Link" }', { mode: "application" })
      }, /Block syntax is not allowed/)
    })
  })

  describe("Mode with Template Features", () => {
    it("document mode works with mustache interpolation", () => {
      const html = compile('p { "Hello, {{name}}!" }', {
        mode: "document",
        context: { name: "World" },
      })
      assert.strictEqual(html, "<p>Hello, World!</p>")
    })

    it("application mode works with mustache interpolation", () => {
      const html = compile('p("Hello, {{name}}!")', {
        mode: "application",
        context: { name: "World" },
      })
      assert.strictEqual(html, "<p>Hello, World!</p>")
    })

    it("document mode works with m-if directive", () => {
      const html = compile('div[m-if="show"] { "Content" }', {
        mode: "document",
        context: { show: true },
      })
      assert.strictEqual(html, "<div>Content</div>")
    })

    it("application mode works with m-if directive", () => {
      const html = compile('div({"m-if":"show"}, "Content")', {
        mode: "application",
        context: { show: true },
      })
      assert.strictEqual(html, "<div>Content</div>")
    })

    it("document mode works with m-each directive", () => {
      const html = compile(
        'ul { li[m-each="items" m-as="item"] { "{{item}}" } }',
        {
          mode: "document",
          context: { items: ["A", "B", "C"] },
        }
      )
      assert.strictEqual(html, "<ul><li>A</li><li>B</li><li>C</li></ul>")
    })

    it("application mode works with m-each directive", () => {
      const html = compile(
        'ul(li({"m-each":"items", "m-as":"item"}, "{{item}}"))',
        {
          mode: "application",
          context: { items: ["A", "B", "C"] },
        }
      )
      assert.strictEqual(html, "<ul><li>A</li><li>B</li><li>C</li></ul>")
    })
  })

  describe("Backward Compatibility", () => {
    it("default mode allows both syntaxes (backward compatible)", () => {
      const block = compile('div.box { "Content" }')
      const func = compile('div({class:"box"}, "Content")')
      assert.strictEqual(block, func)
    })

    it("omitting mode option defaults to mixed", () => {
      const html1 = compile('div.box { p("Hello") }')
      const html2 = compile('div.box { p("Hello") }', { mode: "mixed" })
      assert.strictEqual(html1, html2)
    })

    it("existing tests still pass without mode option", () => {
      assert.strictEqual(compile('p { "Hello" }'), "<p>Hello</p>")
      assert.strictEqual(compile('p("Hello")'), "<p>Hello</p>")
      assert.strictEqual(
        compile('div.container { h1#title { "Title" } }'),
        '<div class="container"><h1 id="title">Title</h1></div>'
      )
    })
  })

  describe("HTML Elements (always allowed)", () => {
    it("document mode accepts HTML elements", () => {
      const html = compile('<div class="box">Content</div>', {
        mode: "document",
      })
      assert.strictEqual(html, '<div class="box">Content</div>')
    })

    it("application mode accepts HTML elements", () => {
      const html = compile('<div class="box">Content</div>', {
        mode: "application",
      })
      assert.strictEqual(html, '<div class="box">Content</div>')
    })
  })
})
