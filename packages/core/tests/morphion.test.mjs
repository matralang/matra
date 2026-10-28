import assert from "node:assert/strict"
import { describe, it } from "node:test"
import core, { astToMatraJSON, astToMorphion, morphionToAST } from "../dist/index.js"

describe("文書nodeとモーフィオンの対応", () => {
  it("指数0にtag、1からchildren、文字列にpropsを対応させる", () => {
    const ast = { tag: "p", props: { class: "lead", 0: "property zero" }, children: ["Hello", 0] }
    const expected = [
      { exponent: 0, val: "p" },
      { exponent: 1, val: "Hello" },
      { exponent: 2, val: 0 },
      { exponent: "0", val: "property zero" },
      { exponent: "class", val: "lead" },
    ]
    assert.deepEqual(astToMorphion(ast), expected)
    assert.deepEqual(morphionToAST([...expected].reverse()), ast)
    assert.equal(core.astToMorphion, astToMorphion)
    assert.equal(core.morphionToAST, morphionToAST)
  })

  it("ゼロ係数・空値・node・配列・mapを落とさずMatraJSONの意味を保存する", () => {
    const ast = {
      tag: "article",
      props: { empty: "", disabled: false, data: { items: [["p", {}, []], null] } },
      children: [0, false, null, "", [], {}, { tag: "p", props: {}, children: ["文書"] }],
    }
    assert.deepEqual(astToMatraJSON(morphionToAST(astToMorphion(ast))), astToMatraJSON(ast))
    assert.deepEqual(morphionToAST([{ exponent: 0, val: "empty" }]), {
      tag: "empty",
      props: {},
      children: [],
    })
  })

  it("property順序に依存せず、入出力を共有せず、nodeのpositionを除外する", () => {
    const position = {
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 1, line: 1, column: 2 },
    }
    const ast = {
      tag: "p",
      props: { z: { list: [1] }, A: 0, a: 2 },
      children: [{ tag: "b", props: {}, children: ["text"], position }],
      position,
    }
    const terms = astToMorphion(ast)
    assert.deepEqual(
      terms.map(term => term.exponent),
      [0, 1, "A", "a", "z"],
    )
    const decoded = morphionToAST(terms)
    assert.equal(decoded.position, undefined)
    assert.equal(decoded.children[0].position, undefined)
    decoded.props.z.list.push(2)
    decoded.children[0].children[0] = "changed"
    assert.deepEqual(ast.props.z.list, [1])
    assert.deepEqual(terms.find(term => term.exponent === "z").val.list, [1])
    assert.equal(terms[1].val.children[0], "text")
  })

  it("特殊なproperty keyを通常のデータとして保持する", () => {
    const terms = [
      { exponent: 0, val: "p" },
      { exponent: "__proto__", val: { answer: 42 } },
      { exponent: "", val: null },
    ]
    const ast = morphionToAST(terms)
    assert.equal(Object.hasOwn(ast.props, "__proto__"), true)
    assert.deepEqual(Object.getOwnPropertyDescriptor(ast.props, "__proto__").value, { answer: 42 })
    assert.equal(Object.getPrototypeOf(ast.props), Object.prototype)
    assert.deepEqual(
      astToMorphion(ast).map(term => term.exponent),
      [0, "", "__proto__"],
    )
  })

  it("重複・欠番・不正なtagと指数を黙って修復しない", () => {
    const tag = { exponent: 0, val: "p" }
    for (const terms of [
      [],
      [tag, tag],
      [tag, { exponent: "x", val: 1 }, { exponent: "x", val: 2 }],
      [tag, { exponent: 2, val: "gap" }],
      [{ exponent: 0, val: 1 }],
      ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, {}, []].map(exponent => [
        tag,
        { exponent, val: 1 },
      ]),
    ])
      assert.throws(() => morphionToAST(terms), TypeError)
  })

  it("非JSON値と循環を両方向で拒否する", () => {
    const cycle = {}
    cycle.self = cycle
    for (const val of [undefined, 1n, Infinity, () => 1, new Date(), [undefined], cycle]) {
      assert.throws(() => astToMorphion({ tag: "p", props: {}, children: [val] }), TypeError)
      assert.throws(
        () =>
          morphionToAST([
            { exponent: 0, val: "p" },
            { exponent: 1, val },
          ]),
        TypeError,
      )
    }
  })
})
