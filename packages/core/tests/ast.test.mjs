import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  astToMatraJSON,
  matraJSONToAST,
  transform,
  visit,
} from "../dist/index.js"

describe("Matra AST", () => {
  it("round-trips AST and MatraJSON recursively", () => {
    const ast = {
      tag: "group",
      props: { kind: "math" },
      children: [{ tag: "add", props: {}, children: [1, 2] }, "tail"],
    }
    const json = ["group", { kind: "math" }, [["add", {}, [1, 2]], "tail"]]
    assert.deepEqual(astToMatraJSON(ast), json)
    assert.deepEqual(matraJSONToAST(json), ast)
  })

  it("round-trips expression nodes stored in props", () => {
    const ast = {
      tag: "circle",
      props: {
        cx: { tag: "Cos", props: {}, children: ["theta"] },
      },
      children: [],
    }
    const json = ["circle", { cx: ["Cos", {}, ["theta"]] }, []]
    assert.deepEqual(astToMatraJSON(ast), json)
    assert.deepEqual(matraJSONToAST(json), ast)
  })

  it("visits and immutably transforms only AST children", () => {
    const ast = {
      tag: "doc",
      props: {},
      children: [{ tag: "p", props: {}, children: ["Hello"] }, "literal"],
    }
    const tags = []
    visit(ast, node => tags.push(node.tag))
    assert.deepEqual(tags, ["doc", "p"])

    const changed = transform(ast, node =>
      node.tag === "p" ? { ...node, tag: "paragraph" } : undefined,
    )
    assert.deepEqual(changed, {
      tag: "doc",
      props: {},
      children: [
        { tag: "paragraph", props: {}, children: ["Hello"] },
        "literal",
      ],
    })
    assert.equal(ast.children[0].tag, "p")
  })

  it("preserves source positions while transforming", () => {
    const position = {
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 3, line: 1, column: 4 },
    }
    const ast = { tag: "old", props: {}, children: [], position }
    assert.deepEqual(transform(ast, node => ({ ...node, tag: "new" })), {
      tag: "new",
      props: {},
      children: [],
      position,
    })
  })
})
