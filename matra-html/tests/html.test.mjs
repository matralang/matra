import assert from "node:assert/strict"
import { describe, it } from "node:test"

const coreURL = new URL("../../dist/index.js", import.meta.url)
const htmlSource = await import("../dist/index.js")
const core = await import(coreURL)
const { toHTML } = htmlSource

describe("@matralang/matra-html", () => {
  it("renders AST using HTML semantics", () => {
    const ast = ["div", { class: "card", hidden: true }, [
      ["p", {}, ["<Hello>"]],
      ["br", {}, []],
    ]]
    assert.equal(
      toHTML(ast),
      '<div class="card" hidden><p>&lt;Hello&gt;</p><br></div>',
    )
  })

  it("renders output from the Core parser", () => {
    assert.equal(toHTML(core.parse('p("Hello")')), "<p>Hello</p>")
  })
})
