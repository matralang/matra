import assert from "node:assert/strict"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import { loadMatra, matra, normalizeMatra } from "../dist/index.js"

describe("JSONMatra family", () => {
  it("loads strict .matra.json object and tuple files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matra-json-"))
    const objectPath = join(dir, "object.matra.json")
    const tuplePath = join(dir, "tuple.matra.json")

    await writeFile(
      objectPath,
      JSON.stringify({
        tag: "tag",
        props: { prop1: "value1" },
        children: ["child1", "child2"],
      }),
    )
    await writeFile(
      tuplePath,
      JSON.stringify(["tag", { prop1: "value1" }, ["child1", "child2"]]),
    )

    const expected = {
      tag: "tag",
      props: { prop1: "value1" },
      children: ["child1", "child2"],
    }

    assert.deepEqual(await loadMatra(objectPath), expected)
    assert.deepEqual(await loadMatra(tuplePath), expected)
  })

  it("rejects invalid JSON in .matra.json files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matra-invalid-json-"))

    for (const [name, source] of [
      ["comment.matra.json", "{ /* no */ \"a\": 1 }"],
      ["undefined.matra.json", "{ \"a\": undefined }"],
      ["bigint.matra.json", "{ \"a\": 9007199254740991n }"],
      ["trailing.matra.json", "{ \"a\": 1, }"],
    ]) {
      const path = join(dir, name)
      await writeFile(path, source)
      await assert.rejects(() => loadMatra(path), SyntaxError)
    }
  })

  it("loads default exports from trusted .matra.js modules", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matra-js-"))
    const corePath = fileURLToPath(new URL("../dist/index.js", import.meta.url))

    const astPath = join(dir, "ast.matra.js")
    await writeFile(
      astPath,
      `import { matra } from ${JSON.stringify(corePath)};\n` +
        `export default matra.ast({ tag: "tag", props: { a: 1 }, children: ["x"] });\n`,
    )

    const docPath = join(dir, "doc.matra.js")
    await writeFile(
      docPath,
      `import { matra } from ${JSON.stringify(corePath)};\n` +
        "export default matra.doc`tag { child }`;\n",
    )

    assert.deepEqual(await loadMatra(astPath), {
      tag: "tag",
      props: { a: 1 },
      children: ["x"],
    })
    assert.deepEqual(await loadMatra(docPath), {
      kind: "MatraDocumentSource",
      source: "tag { child }",
    })
  })

  it("loads minimal .jsonm placeholders without evaluating JavaScript", async () => {
    const dir = await mkdtemp(join(tmpdir(), "matra-jsonm-"))
    const docPath = join(dir, "doc.jsonm")
    const exprPath = join(dir, "expr.jsonm")
    const unsupportedPath = join(dir, "object.jsonm")

    await writeFile(docPath, "matra.doc`tag { child }`\n")
    await writeFile(exprPath, "matra.expr`Divide(Plus(1, Sqrt(5)), 2)`\n")
    await writeFile(unsupportedPath, "{ a: sideEffect() }")

    assert.deepEqual(await loadMatra(docPath), {
      kind: "MatraDocumentSource",
      source: "tag { child }",
    })
    assert.deepEqual(await loadMatra(exprPath), {
      kind: "MatraExpressionSource",
      source: "Divide(Plus(1, Sqrt(5)), 2)",
    })
    await assert.rejects(
      () => loadMatra(unsupportedPath),
      /\.jsonm parsing is not implemented/,
    )
  })

  it("normalizes objects, tuples, primitives, and ordinary arrays", () => {
    assert.deepEqual(normalizeMatra({ tag: "tag" }), {
      tag: "tag",
      props: {},
      children: [],
    })
    assert.deepEqual(normalizeMatra(["tag", { a: 1 }, ["child"]]), {
      tag: "tag",
      props: { a: 1 },
      children: ["child"],
    })
    assert.equal(normalizeMatra("Hello"), "Hello")
    assert.equal(normalizeMatra(42), 42)
    assert.equal(normalizeMatra(true), true)
    assert.equal(normalizeMatra(null), null)
    assert.deepEqual(normalizeMatra(["not", "a", "tuple"]), ["not", "a", "tuple"])
  })

  it("offers explicit matra helpers", () => {
    assert.deepEqual(matra.tuple("tag", { a: 1 }, ["child"]), {
      tag: "tag",
      props: { a: 1 },
      children: ["child"],
    })
    assert.deepEqual(matra.expr("Add(1, 2)"), {
      kind: "MatraExpressionSource",
      source: "Add(1, 2)",
    })
    assert.deepEqual(matra({ a: undefined, b: 9007199254740991n }), {
      a: undefined,
      b: 9007199254740991n,
    })
  })
})
