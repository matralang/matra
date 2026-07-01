import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  astToMatraJSON,
  matraJSONToAST,
  parse,
  parseWith,
  transform,
  visit,
} from "../dist/index.js"

describe("domain-neutral Matra Core", () => {
  it("parses MatraJSON into an object-shaped AST", () => {
    assert.deepEqual(parse('sum(value("a"), 2, axis="x")'), {
      tag: "sum",
      props: { axis: "x" },
      children: [{ tag: "value", props: {}, children: ["a"] }, 2],
    })
  })

  it("parses Python-style keyword props", () => {
    assert.deepEqual(parse("circle(x=10, y=20, r=5)"), {
      tag: "circle",
      props: { x: 10, y: 20, r: 5 },
      children: [],
    })
  })

  it("parses JSON-compatible numeric and null literals", () => {
    assert.deepEqual(parse("values(-7, .5, 1., 6.02e23, missing=null)"), {
      tag: "values",
      props: { missing: null },
      children: [-7, 0.5, 1, 6.02e23],
    })
  })

  it("keeps object-style props as a compatibility syntax", () => {
    assert.deepEqual(parse('circle({x:10}, "label")'), {
      tag: "circle",
      props: { x: 10 },
      children: ["label"],
    })
  })

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

  it("normalizes a replaceable parser's MatraJSON output", () => {
    const parser = {
      parse: () => ["doc", {}, ["Hello"]],
    }
    assert.deepEqual(parseWith(parser, "ignored"), {
      tag: "doc",
      props: {},
      children: ["Hello"],
    })
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
})
