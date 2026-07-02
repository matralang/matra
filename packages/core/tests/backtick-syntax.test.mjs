// backtick-syntax.test.mjs — Backtick text syntax tests
// --------------------------------------------------------
// Tests for the concise backtick syntax: tag`text`

import assert from "node:assert"
import { describe, it } from "node:test"
import { compile } from "../dist/index.js"

describe("Backtick Text Syntax", () => {
  describe("Basic Usage", () => {
    it("creates element with text using backticks", () => {
      const html = compile("h1`Hello`")
      assert.strictEqual(html, "<h1>Hello</h1>")
    })

    it("works with paragraph tags", () => {
      const html = compile("p`This is a paragraph`")
      assert.strictEqual(html, "<p>This is a paragraph</p>")
    })

    it("works with span tags", () => {
      const html = compile("span`Short text`")
      assert.strictEqual(html, "<span>Short text</span>")
    })

    it("handles empty backticks", () => {
      const html = compile("div``")
      assert.strictEqual(html, "<div></div>")
    })
  })

  describe("With Class Selectors", () => {
    it("works with single class", () => {
      const html = compile("div.container`Welcome`")
      assert.strictEqual(html, '<div class="container">Welcome</div>')
    })

    it("works with multiple classes", () => {
      const html = compile("p.intro.highlight`Important text`")
      assert.strictEqual(html, '<p class="intro highlight">Important text</p>')
    })

    it("works with complex class names", () => {
      const html = compile("div.btn-primary.btn-large`Click me`")
      assert.strictEqual(
        html,
        '<div class="btn-primary btn-large">Click me</div>'
      )
    })
  })

  describe("With ID Selectors", () => {
    it("works with id", () => {
      const html = compile("p#intro`This is an introduction`")
      assert.strictEqual(html, '<p id="intro">This is an introduction</p>')
    })

    it("works with id and class", () => {
      const html = compile("div#main.container`Main content`")
      assert.strictEqual(
        html,
        '<div id="main" class="container">Main content</div>'
      )
    })

    it("works with multiple classes and id", () => {
      const html = compile("h1#title.header.large`Page Title`")
      assert.strictEqual(
        html,
        '<h1 id="title" class="header large">Page Title</h1>'
      )
    })
  })

  describe("With Attributes", () => {
    it("works with single attribute", () => {
      const html = compile('a[href="/"]`Home`')
      assert.strictEqual(html, '<a href="/">Home</a>')
    })

    it("works with multiple attributes", () => {
      const html = compile('a[href="/" target="_blank"]`External Link`')
      assert.strictEqual(html, '<a href="/" target="_blank">External Link</a>')
    })

    it("works with class, id, and attributes", () => {
      const html = compile('a.link#home[href="/" title="Go home"]`Home Page`')
      assert.strictEqual(
        html,
        '<a href="/" title="Go home" id="home" class="link">Home Page</a>'
      )
    })
  })

  describe("Nested Usage", () => {
    it("works inside block syntax", () => {
      const html = compile("div.container { h1`Hello` p`Welcome!` }")
      assert.strictEqual(
        html,
        '<div class="container"><h1>Hello</h1><p>Welcome!</p></div>'
      )
    })

    it("works with multiple nested elements", () => {
      const html = compile(
        "article { header { h1`Article Title` } section { p`Article content` } footer { span`Author` } }"
      )
      assert.strictEqual(
        html,
        "<article><header><h1>Article Title</h1></header><section><p>Article content</p></section><footer><span>Author</span></footer></article>"
      )
    })

    it("works with complex nesting", () => {
      const html = compile(
        'nav.menu { ul { li { a[href="/"]`Home` } li { a[href="/about"]`About` } li { a[href="/contact"]`Contact` } } }'
      )
      assert.ok(html.includes('<nav class="menu">'))
      assert.ok(html.includes('<a href="/">Home</a>'))
      assert.ok(html.includes('<a href="/about">About</a>'))
      assert.ok(html.includes('<a href="/contact">Contact</a>'))
    })
  })

  describe("Special Characters", () => {
    it("handles text with spaces", () => {
      const html = compile("p`Hello World from Matra`")
      assert.strictEqual(html, "<p>Hello World from Matra</p>")
    })

    it("handles text with punctuation", () => {
      const html = compile("p`Hello, World! How are you?`")
      assert.strictEqual(html, "<p>Hello, World! How are you?</p>")
    })

    it("handles text with numbers", () => {
      const html = compile("p`Version 1.0.0`")
      assert.strictEqual(html, "<p>Version 1.0.0</p>")
    })

    it("handles text with special HTML characters", () => {
      const html = compile("p`<Hello> & 'Goodbye'`")
      assert.strictEqual(html, "<p>&lt;Hello&gt; &amp; &#039;Goodbye&#039;</p>")
    })
  })

  describe("Template Variables", () => {
    it("works with mustache interpolation", () => {
      const html = compile("h1`Hello, {{name}}!`", {
        context: { name: "World" },
      })
      assert.strictEqual(html, "<h1>Hello, World!</h1>")
    })

    it("works with multiple variables", () => {
      const html = compile("p`{{greeting}}, {{name}}!`", {
        context: { greeting: "Hello", name: "Matra" },
      })
      assert.strictEqual(html, "<p>Hello, Matra!</p>")
    })

    it("works with nested property access", () => {
      const html = compile("p`Welcome, {{user.name}}!`", {
        context: { user: { name: "Alice" } },
      })
      assert.strictEqual(html, "<p>Welcome, Alice!</p>")
    })
  })

  describe("Comparison with Other Syntaxes", () => {
    it("produces same output as block syntax with quotes", () => {
      const backtick = compile("p`Hello`")
      const block = compile('p { "Hello" }')
      assert.strictEqual(backtick, block)
    })

    it("produces same output as function syntax", () => {
      const backtick = compile("p`Hello`")
      const func = compile('p("Hello")')
      assert.strictEqual(backtick, func)
    })

    it("produces same output as HTML syntax", () => {
      const backtick = compile("p`Hello`")
      const html = compile("<p>Hello</p>")
      assert.strictEqual(backtick, html)
    })
  })

  describe("Syntax Modes", () => {
    it("works in document mode", () => {
      const html = compile("h1`Hello`", { mode: "document" })
      assert.strictEqual(html, "<h1>Hello</h1>")
    })

    it("rejects in application mode", () => {
      assert.throws(() => {
        compile("h1`Hello`", { mode: "application" })
      }, /Block syntax is not allowed/)
    })

    it("works in mixed mode (default)", () => {
      const html = compile("h1`Hello`")
      assert.strictEqual(html, "<h1>Hello</h1>")
    })
  })

  describe("Real-World Examples", () => {
    it("creates a simple blog post card", () => {
      const html = compile(
        'article.post-card { h2.title`Blog Post Title` p.excerpt`This is a short excerpt from the blog post...` a.read-more[href="/post/1"]`Read more →` }'
      )
      assert.ok(html.includes('<article class="post-card">'))
      assert.ok(html.includes('<h2 class="title">Blog Post Title</h2>'))
      assert.ok(html.includes("short excerpt"))
      assert.ok(html.includes("Read more →"))
    })

    it("creates a navigation menu", () => {
      const html = compile(
        'nav.main-nav { ul.nav-list { li { a[href="/"]`Home` } li { a[href="/about"]`About` } li { a[href="/services"]`Services` } li { a[href="/contact"]`Contact` } } }'
      )
      assert.ok(html.includes('<nav class="main-nav">'))
      assert.ok(html.includes('<a href="/">Home</a>'))
      assert.ok(html.includes('<a href="/contact">Contact</a>'))
    })

    it("creates a hero section", () => {
      const html = compile(
        'section#hero.hero { h1.hero-title`Welcome to Matra` p.hero-subtitle`A lightweight, expressive template language` a.btn.btn-primary[href="/get-started"]`Get Started` }'
      )
      assert.ok(html.includes('<section id="hero" class="hero">'))
      assert.ok(html.includes("Welcome to Matra"))
      assert.ok(html.includes("Get Started"))
    })
  })
})
