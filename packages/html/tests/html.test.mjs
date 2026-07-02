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
})
