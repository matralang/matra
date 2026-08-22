import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parse } from "@matra/core"

const htmlSource = await import("../dist/index.js")
const { toHTML } = htmlSource

describe("@matra/html", () => {
  it("renders AST using HTML semantics", () => {
    const ast = {
      tag: "div",
      props: { class: "card", hidden: true },
      children: [
        { tag: "p", props: {}, children: ["<Hello>"] },
        { tag: "br", props: {}, children: [] },
      ],
    }
    assert.equal(
      toHTML(ast),
      '<div class="card" hidden><p>&lt;Hello&gt;</p><br></div>',
    )
  })

  it("renders output from the Core parser", () => {
    assert.equal(toHTML(parse('p("Hello")')), "<p>Hello</p>")
  })

  it("preserves inline script content", () => {
    assert.equal(
      toHTML(parse('script { "window.dataLayer = window.dataLayer || [];" }')),
      "<script>window.dataLayer = window.dataLayer || [];</script>",
    )
  })

  it("pretty-prints element structure without changing code content", () => {
    const ast = {
      tag: "html",
      props: {},
      children: [{
        tag: "body",
        props: {},
        children: [{
          tag: "main",
          props: {},
          children: [{
            tag: "pre",
            props: {},
            children: [{ tag: "code", props: {}, children: ["one\ntwo"] }],
          }],
        }],
      }],
    }
    assert.equal(
      toHTML(ast, { pretty: true }),
      "<html>\n" +
        "  <body>\n" +
        "    <main>\n" +
        "      <pre><code>one\ntwo</code></pre>\n" +
        "    </main>\n" +
        "  </body>\n" +
        "</html>",
    )
  })

  it("prefixes site-root links for static deployments", () => {
    const ast = parse(`$root {
      a[href="/docs/"] { "Docs" }
      img[src="/image.svg"];
      a[href="https://example.com/"] { "External" }
      img[src="//cdn.example.com/image.svg"];
    }`)
    assert.equal(
      toHTML(ast, { basePath: "/website/" }),
      '<a href="/website/docs/">Docs</a><img src="/website/image.svg"><a href="https://example.com/">External</a><img src="//cdn.example.com/image.svg">',
    )
  })
})
