import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { evaluateStatic, parse, staticValueToAST } from "@matra/core"

const htmlSource = await import("../dist/index.js")
const { toHTML } = htmlSource
const parseStaticDocument = source => staticValueToAST(evaluateStatic(parse(source)))

describe("@matra/html", () => {
  it("renders whitespace-separated Matra attributes with unchanged value types", () => {
    const source = 'a.button(href="/spec/" title="Matra" hidden=true count=3) { "Read" }'
    assert.equal(
      toHTML(parseStaticDocument(source)),
      '<a href="/spec/" title="Matra" hidden count="3" class="button">Read</a>',
    )
  })
  it("renders AST using HTML semantics", () => {
    const ast = {
      tag: "div",
      props: { class: "card", hidden: true },
      children: [
        { tag: "p", props: {}, children: ["<Hello>"] },
        { tag: "br", props: {}, children: [] },
      ],
    }
    assert.equal(toHTML(ast), '<div class="card" hidden><p>&lt;Hello&gt;</p><br></div>')
  })

  it("renders output from the Core parser", () => {
    assert.equal(toHTML(parseStaticDocument('p { "Hello" }')), "<p>Hello</p>")
  })

  it("renders markup nodes with decoded text and HTML void semantics", () => {
    const source =
      '<article><p title="A &amp; B">Hello <strong>Matra</strong> &lt;3</p><img src="image.png" /></article>'
    assert.equal(
      toHTML(parseStaticDocument(source)),
      '<article><p title="A &amp; B">Hello <strong>Matra</strong> &lt;3</p><img src="image.png"></article>',
    )
  })

  it("renders class shorthand through the existing node semantics", () => {
    assert.equal(
      toHTML(
        parseStaticDocument(
          '<a.matra-button.primary.matra-button href="/spec/" class="ignored">Read the spec</a>',
        ),
      ),
      '<a href="/spec/" class="matra-button primary">Read the spec</a>',
    )
    assert.equal(toHTML(parseStaticDocument("<hr.divider />")), '<hr class="divider">')
  })

  it("preserves the Playground card AST and output after markup refinement", async () => {
    const markdown = await readFile(
      new URL("../../../apps/website/src/pages/play.md", import.meta.url),
      "utf8",
    )
    const source = markdown.match(/```card\.matra\n([\s\S]*?)\n```/)?.[1]
    assert.ok(source)
    const previous = `article.matra-frame {
  p.eyebrow { "MATRA" }
  h2 { "Structure first." }
  p { "Edit this source and watch it render." }
  a.matra-button(href="/spec/") { "Read the spec" }
  hr {}
}`
    assert.deepEqual(parseStaticDocument(source), parseStaticDocument(previous))
    for (const options of [{}, { pretty: true }, { basePath: "/website/" }]) {
      assert.equal(
        toHTML(parseStaticDocument(source), options),
        toHTML(parseStaticDocument(previous), options),
      )
    }
  })

  it("preserves inline script content", () => {
    assert.equal(
      toHTML(parseStaticDocument('script { "window.dataLayer = window.dataLayer || [];" }')),
      "<script>window.dataLayer = window.dataLayer || [];</script>",
    )
  })

  it("pretty-prints element structure without changing code content", () => {
    const ast = {
      tag: "html",
      props: {},
      children: [
        {
          tag: "body",
          props: {},
          children: [
            {
              tag: "main",
              props: {},
              children: [
                {
                  tag: "pre",
                  props: {},
                  children: [{ tag: "code", props: {}, children: ["one\ntwo"] }],
                },
              ],
            },
          ],
        },
      ],
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
    const ast = [
      parseStaticDocument('a(href="/docs/") { "Docs" }'),
      parseStaticDocument('img(src="/image.svg") {}'),
      parseStaticDocument('a(href="https://example.com/") { "External" }'),
      parseStaticDocument('img(src="//cdn.example.com/image.svg") {}'),
    ]
    assert.equal(
      toHTML(ast, { basePath: "/website/" }),
      '<a href="/website/docs/">Docs</a><img src="/website/image.svg"><a href="https://example.com/">External</a><img src="//cdn.example.com/image.svg">',
    )
  })
})
