// function-syntax.test.mjs — Matra v0.8 function-style syntax tests
// --------------------------------------------------------------------
// Tests for p("Hello"), div({class:"red"}, p("Inner")), etc.

import assert from "node:assert"
import { describe, it } from "node:test"
import { parse } from "../src/matra-parser.mjs"

describe("Matra v0.8 Function-Style Syntax", () => {
  it('parses simple function call: p("Hello")', () => {
    const src = 'p("Hello")'
    const ast = parse(src)
    assert.deepStrictEqual(ast, {
      type: "element",
      tagName: "p",
      properties: {},
      children: [{ type: "text", value: "Hello" }],
    })
  })

  it('parses function with properties: h1({class:"title"},"Hello!")', () => {
    const src = 'h1({class:"title"},"Hello!")'
    const ast = parse(src)
    assert.deepStrictEqual(ast, {
      type: "element",
      tagName: "h1",
      properties: { class: "title" },
      children: [{ type: "text", value: "Hello!" }],
    })
  })

  it('parses nested function calls: div(p("A"),p("B"))', () => {
    const src = 'div(p("A"),p("B"))'
    const ast = parse(src)
    assert.deepStrictEqual(ast, {
      type: "element",
      tagName: "div",
      properties: {},
      children: [
        {
          type: "element",
          tagName: "p",
          properties: {},
          children: [{ type: "text", value: "A" }],
        },
        {
          type: "element",
          tagName: "p",
          properties: {},
          children: [{ type: "text", value: "B" }],
        },
      ],
    })
  })

  it("parses function with multiple properties", () => {
    const src = 'a({href:"https://example.com",class:"link"},"Click here")'
    const ast = parse(src)
    assert.deepStrictEqual(ast, {
      type: "element",
      tagName: "a",
      properties: {
        href: "https://example.com",
        class: "link",
      },
      children: [{ type: "text", value: "Click here" }],
    })
  })

  it("parses empty function call: div()", () => {
    const src = "div()"
    const ast = parse(src)
    assert.deepStrictEqual(ast, {
      type: "element",
      tagName: "div",
      properties: {},
      children: [],
    })
  })

  it('parses function with only properties: img({src:"cat.png",alt:"cat"})', () => {
    const src = 'img({src:"cat.png",alt:"cat"})'
    const ast = parse(src)
    assert.deepStrictEqual(ast, {
      type: "element",
      tagName: "img",
      properties: {
        src: "cat.png",
        alt: "cat",
      },
      children: [],
    })
  })

  it('parses complex nesting: div({class:"container"},h1("Title"),p("Text"))', () => {
    const src = 'div({class:"container"},h1("Title"),p("Text"))'
    const ast = parse(src)
    assert.deepStrictEqual(ast, {
      type: "element",
      tagName: "div",
      properties: { class: "container" },
      children: [
        {
          type: "element",
          tagName: "h1",
          properties: {},
          children: [{ type: "text", value: "Title" }],
        },
        {
          type: "element",
          tagName: "p",
          properties: {},
          children: [{ type: "text", value: "Text" }],
        },
      ],
    })
  })

  it("parses function with number properties", () => {
    const src = "canvas({width:800,height:600})"
    const ast = parse(src)
    assert.deepStrictEqual(ast, {
      type: "element",
      tagName: "canvas",
      properties: {
        width: 800,
        height: 600,
      },
      children: [],
    })
  })

  it("parses function with boolean properties", () => {
    const src = 'input({type:"checkbox",checked:true})'
    const ast = parse(src)
    assert.deepStrictEqual(ast, {
      type: "element",
      tagName: "input",
      properties: {
        type: "checkbox",
        checked: true,
      },
      children: [],
    })
  })

  it("parses deeply nested structure", () => {
    const src =
      'ul(li(a({href:"/page1"},"Page 1")),li(a({href:"/page2"},"Page 2")))'
    const ast = parse(src)
    assert.deepStrictEqual(ast, {
      type: "element",
      tagName: "ul",
      properties: {},
      children: [
        {
          type: "element",
          tagName: "li",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "a",
              properties: { href: "/page1" },
              children: [{ type: "text", value: "Page 1" }],
            },
          ],
        },
        {
          type: "element",
          tagName: "li",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "a",
              properties: { href: "/page2" },
              children: [{ type: "text", value: "Page 2" }],
            },
          ],
        },
      ],
    })
  })
})
