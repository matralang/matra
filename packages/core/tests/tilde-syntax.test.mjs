import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { matra } from "../dist/index.js"

describe("Tilde Syntax", () => {
  describe("Basic usage", () => {
    test("simple text with tilde", () => {
      const template = "h1~Hello~"
      const result = matra(template)
      assert.equal(result, "<h1>Hello</h1>")
    })

    test("text with spaces", () => {
      const template = "p~Hello World~"
      const result = matra(template)
      assert.equal(result, "<p>Hello World</p>")
    })

    test("empty text", () => {
      const template = "div~~"
      const result = matra(template)
      assert.equal(result, "<div></div>")
    })

    test("text with special characters", () => {
      const template = "span~Hello, World! 123~"
      const result = matra(template)
      assert.equal(result, "<span>Hello, World! 123</span>")
    })
  })

  describe("With class selectors", () => {
    test("single class", () => {
      const template = "div.container~Content~"
      const result = matra(template)
      assert.equal(result, '<div class="container">Content</div>')
    })

    test("multiple classes", () => {
      const template = "p.text.bold~Hello~"
      const result = matra(template)
      assert.equal(result, '<p class="text bold">Hello</p>')
    })

    test("class after text", () => {
      const template = "h2.title~Title~"
      const result = matra(template)
      assert.equal(result, '<h2 class="title">Title</h2>')
    })
  })

  describe("With ID selectors", () => {
    test("single ID", () => {
      const template = "div#main~Content~"
      const result = matra(template)
      assert.equal(result, '<div id="main">Content</div>')
    })

    test("ID and class", () => {
      const template = "div#app.container~App~"
      const result = matra(template)
      assert.equal(result, '<div id="app" class="container">App</div>')
    })

    test("class before ID", () => {
      const template = "section.hero#top~Hero~"
      const result = matra(template)
      assert.equal(result, '<section id="top" class="hero">Hero</section>')
    })
  })

  describe("With attributes", () => {
    test("single attribute", () => {
      const template = 'a[href="/page"]~Link~'
      const result = matra(template)
      assert.equal(result, '<a href="/page">Link</a>')
    })

    test("multiple attributes", () => {
      const template = 'img[src="image.jpg" alt="Photo"]~~'
      const result = matra(template)
      assert.equal(result, '<img src="image.jpg" alt="Photo">')
    })

    test("attributes with class and ID", () => {
      const template = 'button#submit.btn[type="submit"]~Send~'
      const result = matra(template)
      assert.equal(
        result,
        '<button type="submit" id="submit" class="btn">Send</button>'
      )
    })
  })

  describe("Nested structures", () => {
    test("tilde text inside block", () => {
      const template = "div {\n  p~Nested~\n}"
      const result = matra(template)
      assert.equal(result, "<div><p>Nested</p></div>")
    })

    test("multiple tilde texts in block", () => {
      const template = "div {\n  h1~Title~\n  p~Content~\n}"
      const result = matra(template)
      assert.equal(result, "<div><h1>Title</h1><p>Content</p></div>")
    })

    test("tilde with nested children", () => {
      const template = "div {\n  span~Text~\n  div { p~Inner~ }\n}"
      const result = matra(template)
      assert.equal(
        result,
        "<div><span>Text</span><div><p>Inner</p></div></div>"
      )
    })
  })

  describe("Mixed with other syntax", () => {
    test("tilde and backtick syntax together", () => {
      const template = "div {\n  h1~Title~\n  p`Paragraph`\n}"
      const result = matra(template)
      assert.equal(result, "<div><h1>Title</h1><p>Paragraph</p></div>")
    })

    test("tilde and block syntax", () => {
      const template = 'div {\n  h1~Title~\n  p { "Content" }\n}'
      const result = matra(template)
      assert.equal(result, "<div><h1>Title</h1><p>Content</p></div>")
    })

    test("tilde and function syntax in mixed mode", () => {
      const template = 'div {\n  h1~Title~\n  p("Text")\n}'
      const result = matra(template)
      assert.equal(result, "<div><h1>Title</h1><p>Text</p></div>")
    })
  })

  describe("Real-world examples", () => {
    test("navigation menu", () => {
      const template =
        'nav#menu.navbar {\n  a[href="/"]~Home~\n  a[href="/about"]~About~\n  a[href="/contact"]~Contact~\n}'
      const result = matra(template)
      assert.equal(
        result,
        '<nav id="menu" class="navbar"><a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact</a></nav>'
      )
    })

    test("card component", () => {
      const template =
        "div.card {\n  h2.card-title~Card Title~\n  p.card-text~This is card content.~\n  button.btn~Read More~\n}"
      const result = matra(template)
      assert.equal(
        result,
        '<div class="card"><h2 class="card-title">Card Title</h2><p class="card-text">This is card content.</p><button class="btn">Read More</button></div>'
      )
    })

    test("form with labels", () => {
      const template =
        'form {\n  label[for="name"]~Name:~\n  input[type="text" id="name"]~~\n  label[for="email"]~Email:~\n  input[type="email" id="email"]~~\n}'
      const result = matra(template)
      assert.equal(
        result,
        '<form><label for="name">Name:</label><input type="text" id="name"><label for="email">Email:</label><input type="email" id="email"></form>'
      )
    })

    test("article structure", () => {
      const template =
        "article {\n  h1~Article Title~\n  p.meta~Published on 2024-01-01~\n  p~Article content goes here.~\n}"
      const result = matra(template)
      assert.equal(
        result,
        '<article><h1>Article Title</h1><p class="meta">Published on 2024-01-01</p><p>Article content goes here.</p></article>'
      )
    })
  })

  describe("Syntax mode enforcement", () => {
    test("tilde allowed in mixed mode (default)", () => {
      const template = "p~Text~"
      const result = matra(template)
      assert.equal(result, "<p>Text</p>")
    })

    test("tilde allowed in document mode", () => {
      const template = "p~Text~"
      const result = matra(template, { mode: "document" })
      assert.equal(result, "<p>Text</p>")
    })

    test("tilde not allowed in application mode", () => {
      const template = "p~Text~"
      assert.throws(
        () => matra(template, { mode: "application" }),
        /Block syntax is not allowed in application mode/
      )
    })
  })
})
