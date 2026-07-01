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
  it("parses to compact AST", () => {
    assert.deepEqual(parse('sum(value("a"), 2, axis="x")'), [
      "sum",
      { axis: "x" },
      [["value", {}, ["a"]], 2],
    ])
  })

  it("parses Python-style keyword props", () => {
    assert.deepEqual(parse("circle(x=10, y=20, r=5)"), [
      "circle",
      { x: 10, y: 20, r: 5 },
      [],
    ])
  })

  it("keeps object-style props as a compatibility syntax", () => {
    assert.deepEqual(parse('circle({x:10}, "label")'), [
      "circle",
      { x: 10 },
      ["label"],
    ])
  })

  it("round-trips AST and MatraJSON recursively", () => {
    const ast = ["group", { kind: "math" }, [["add", {}, [1, 2]], "tail"]]
    const json = {
      tag: "group",
      props: { kind: "math" },
      children: [
        { tag: "add", props: {}, children: [1, 2] },
        "tail",
      ],
    }
    assert.deepEqual(astToMatraJSON(ast), json)
    assert.deepEqual(matraJSONToAST(json), ast)
  })

  it("normalizes a replaceable parser's MatraJSON output", () => {
    const parser = {
      parse: () => ({ tag: "doc", props: {}, children: ["Hello"] }),
    }
    assert.deepEqual(parseWith(parser, "ignored"), ["doc", {}, ["Hello"]])
  })

  it("visits and immutably transforms only AST children", () => {
    const ast = ["doc", {}, [["p", {}, ["Hello"]], "literal"]]
    const tags = []
    visit(ast, node => tags.push(node[0]))
    assert.deepEqual(tags, ["doc", "p"])

    const changed = transform(ast, node =>
      node[0] === "p" ? ["paragraph", node[1], node[2]] : undefined,
    )
    assert.deepEqual(changed, ["doc", {}, [["paragraph", {}, ["Hello"]], "literal"]])
    assert.equal(ast[2][0][0], "p")
  })
})
