// comprehensive-v08.test.mjs — End-to-end v0.8 feature verification
// -------------------------------------------------------------------

import assert from "node:assert"
import { describe, it } from "node:test"
import { parse, compile, transform } from "../dist/index.js"

describe("Matra v0.8 Comprehensive Tests", () => {
  describe("Function Syntax Basics", () => {
    it("creates elements with text content", () => {
      const html = compile('p("Hello")')
      assert.strictEqual(html, "<p>Hello</p>")
    })

    it("creates elements with properties", () => {
      const html = compile('a({href:"/home", class:"link"}, "Home")')
      assert.strictEqual(html, '<a href="/home" class="link">Home</a>')
    })

    it("supports nested elements", () => {
      const html = compile('div(p("A"), p("B"))')
      assert.strictEqual(html, "<div><p>A</p><p>B</p></div>")
    })

    it("handles empty elements", () => {
      const html = compile("div()")
      assert.strictEqual(html, "<div></div>")
    })
  })

  describe("Property Types", () => {
    it("supports string properties", () => {
      const html = compile('input({type:"text", name:"username"})')
      assert.strictEqual(html, '<input type="text" name="username">')
    })

    it("supports number properties", () => {
      const html = compile("canvas({width:800, height:600})")
      assert.strictEqual(html, '<canvas width="800" height="600"></canvas>')
    })

    it("supports boolean properties", () => {
      const html = compile(
        'input({type:"checkbox", checked:true, disabled:false})'
      )
      assert.strictEqual(html, '<input type="checkbox" checked>')
    })
  })

  describe("Template Integration", () => {
    it("interpolates mustache variables", () => {
      const html = compile('p("Hello, {{name}}!")', {
        context: { name: "Butchi" },
      })
      assert.strictEqual(html, "<p>Hello, Butchi!</p>")
    })

    it("works with m-if directive (truthy)", () => {
      const html = compile('div({"m-if":"isActive"}, "Active")', {
        context: { isActive: true },
      })
      assert.strictEqual(html, "<div>Active</div>")
    })

    it("works with m-if directive (falsy)", () => {
      const html = compile('div({"m-if":"isActive"}, "Active")', {
        context: { isActive: false },
      })
      assert.strictEqual(html, "")
    })

    it("works with m-each directive", () => {
      const html = compile(
        'ul(li({"m-each":"items", "m-as":"item"}, "{{item}}"))',
        {
          context: { items: ["Apple", "Banana", "Cherry"] },
        }
      )
      assert.strictEqual(
        html,
        "<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>"
      )
    })

    it("supports nested property access", () => {
      const html = compile('p("{{user.profile.name}}")', {
        context: { user: { profile: { name: "Butchi" } } },
      })
      assert.strictEqual(html, "<p>Butchi</p>")
    })
  })

  describe("Block Syntax Compatibility", () => {
    it("block syntax still works", () => {
      const html = compile('div.container { h1 { "Title" } }')
      assert.strictEqual(html, '<div class="container"><h1>Title</h1></div>')
    })

    it("produces same output as function syntax", () => {
      const block = compile('div.box { p { "Content" } }')
      const func = compile('div({class:"box"}, p("Content"))')
      assert.strictEqual(block, func)
    })

    it("supports CSS-like selectors", () => {
      const html = compile('div.container { p#main { "Content" } }')
      assert.strictEqual(
        html,
        '<div class="container"><p id="main">Content</p></div>'
      )
    })

    it("supports attribute syntax", () => {
      const html = compile('a[href="/page" target="_blank"] { "Link" }')
      assert.strictEqual(html, '<a href="/page" target="_blank">Link</a>')
    })
  })

  describe("Real-World Patterns", () => {
    it("creates navigation menus", () => {
      const html = compile(`
        nav({class:"menu"},
          ul(
            li(a({href:"/"}, "Home")),
            li(a({href:"/products"}, "Products")),
            li(a({href:"/contact"}, "Contact"))
          )
        )
      `)
      assert.strictEqual(
        html,
        '<nav class="menu"><ul><li><a href="/">Home</a></li><li><a href="/products">Products</a></li><li><a href="/contact">Contact</a></li></ul></nav>'
      )
    })

    it("creates card components", () => {
      const html = compile(
        `
        article({class:"card"},
          header(h2({class:"title"}, "{{title}}")),
          div({class:"body"}, p("{{content}}")),
          footer(a({href:"{{link}}"}, "More"))
        )
      `,
        {
          context: {
            title: "v0.8 Release",
            content: "Function syntax is here!",
            link: "/blog/v0.8",
          },
        }
      )
      assert.strictEqual(
        html,
        '<article class="card"><header><h2 class="title">v0.8 Release</h2></header><div class="body"><p>Function syntax is here!</p></div><footer><a href="/blog/v0.8">More</a></footer></article>'
      )
    })

    it("creates forms", () => {
      const html = compile(`
        form({action:"/login", method:"post"},
          div(
            label({for:"email"}, "Email:"),
            input({type:"email", id:"email", required:true})
          ),
          div(
            label({for:"password"}, "Password:"),
            input({type:"password", id:"password", required:true})
          ),
          button({type:"submit"}, "Login")
        )
      `)
      assert.strictEqual(
        html,
        '<form action="/login" method="post"><div><label for="email">Email:</label><input type="email" id="email" required></div><div><label for="password">Password:</label><input type="password" id="password" required></div><button type="submit">Login</button></form>'
      )
    })

    it("handles complex nested structures", () => {
      const html = compile(`
        section({class:"products"},
          h2("Our Products"),
          div({class:"grid"},
            article({class:"product"},
              img({src:"/prod1.jpg", alt:"Product 1"}),
              h3("Product 1"),
              p({class:"price"}, "$29.99")
            ),
            article({class:"product"},
              img({src:"/prod2.jpg", alt:"Product 2"}),
              h3("Product 2"),
              p({class:"price"}, "$39.99")
            )
          )
        )
      `)
      assert.ok(html.includes('<section class="products">'))
      assert.ok(html.includes('<article class="product">'))
      assert.ok(html.includes("$29.99"))
      assert.ok(html.includes("$39.99"))
    })
  })

  describe("AST Verification", () => {
    it("produces HAST-compatible nodes", () => {
      const ast = parse('p("Hello")')
      assert.strictEqual(ast.type, "element")
      assert.strictEqual(ast.tagName, "p")
      assert.deepStrictEqual(ast.properties, {})
      assert.strictEqual(ast.children.length, 1)
      assert.strictEqual(ast.children[0].type, "text")
      assert.strictEqual(ast.children[0].value, "Hello")
    })

    it("handles properties in AST", () => {
      const ast = parse('div({class:"box", id:"main"})')
      assert.strictEqual(ast.type, "element")
      assert.strictEqual(ast.tagName, "div")
      assert.deepStrictEqual(ast.properties, { class: "box", id: "main" })
    })

    it("handles nested elements in AST", () => {
      const ast = parse("div(p(span()))")
      assert.strictEqual(ast.tagName, "div")
      assert.strictEqual(ast.children[0].tagName, "p")
      assert.strictEqual(ast.children[0].children[0].tagName, "span")
    })
  })

  describe("Transform Module Integration", () => {
    it("transforms function syntax with context", () => {
      const ast = parse('p("{{message}}")')
      const transformed = transform(ast, { message: "Hello" })
      assert.strictEqual(transformed.children[0].value, "Hello")
    })

    it("applies m-if on function syntax", () => {
      const ast = parse('div({"m-if":"show"}, "Content")')
      const shown = transform(ast, { show: true })
      const hidden = transform(ast, { show: false })
      assert.strictEqual(shown.tagName, "div")
      assert.strictEqual(hidden, null)
    })
  })

  describe("Edge Cases", () => {
    it("handles deeply nested function calls", () => {
      const html = compile("div(div(div(div(p(span())))))")
      assert.strictEqual(
        html,
        "<div><div><div><div><p><span></span></p></div></div></div></div>"
      )
    })

    it("handles many siblings", () => {
      const html = compile('ul(li("1"), li("2"), li("3"), li("4"), li("5"))')
      assert.strictEqual(
        html,
        "<ul><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li></ul>"
      )
    })

    it("handles empty property objects", () => {
      const html = compile('p({}, "Text")')
      assert.strictEqual(html, "<p>Text</p>")
    })

    it("handles properties only (no children)", () => {
      const html = compile('hr({class:"divider"})')
      assert.strictEqual(html, '<hr class="divider">')
    })

    it("handles special characters in text", () => {
      const html = compile('p("Hello & goodbye <3")')
      assert.strictEqual(html, "<p>Hello &amp; goodbye &lt;3</p>")
    })
  })
})
