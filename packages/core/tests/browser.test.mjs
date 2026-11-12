import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import {
  EvaluationRequiredError,
  evaluate,
  evaluateStatic,
  ProgramSyntaxError,
  parse,
  staticValueToAST,
} from "@matra/core/browser"
import * as asyncBrowser from "@matra/core/browser-async"

const dist = fileURLToPath(new URL("../dist/", import.meta.url))
const packageJSON = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

describe("browser entry point", () => {
  it("is a public package subpath", () => {
    assert.equal(packageJSON.exports["./browser"].import, "./dist/browser.js")
    assert.equal(packageJSON.exports["./browser"].types, "./dist/browser.d.ts")
    assert.equal(packageJSON.exports["./browser-async"].import, "./dist/browser-async.js")
    assert.equal(packageJSON.exports["./browser-async"].types, "./dist/browser-async.d.ts")
  })

  it("parses, evaluates, and converts documents without the Node host", () => {
    const ast = staticValueToAST(
      evaluate(
        parse(`
fn label(value) { return value }
article {
  h1 { label("Browser-safe Core") }
  p { "A document value." }
}
`),
      ),
    )

    assert.deepEqual(ast, {
      tag: "article",
      props: {},
      children: [
        { tag: "h1", props: {}, children: ["Browser-safe Core"] },
        { tag: "p", props: {}, children: ["A document value."] },
      ],
    })
    assert.throws(() => evaluateStatic(parse("article { 1 + 2 }")), EvaluationRequiredError)
    assert.throws(() => parse("article {"), ProgramSyntaxError)
  })

  it("has no Node built-ins in its transitive JavaScript imports", async () => {
    const visited = new Set()
    const pending = [join(dist, "browser.js"), join(dist, "browser-async.js")]

    while (pending.length > 0) {
      const file = pending.pop()
      if (visited.has(file)) continue
      visited.add(file)
      const source = await readFile(file, "utf8")

      for (const [, specifier] of source.matchAll(
        /(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g,
      )) {
        assert.ok(!specifier.startsWith("node:"), `${relative(dist, file)} imports ${specifier}`)
        if (!specifier.startsWith(".")) continue
        const dependency = resolve(dirname(file), specifier)
        const pathFromDist = relative(dist, dependency)
        assert.ok(
          pathFromDist !== ".." && !pathFromDist.startsWith(`..${sep}`),
          `${specifier} resolves outside dist`,
        )
        pending.push(dependency)
      }
    }
  })

  it("keeps the asynchronous parser compatible with grammar fixtures and diagnostics", async () => {
    const fixtures = JSON.parse(
      await readFile(new URL("../../../spec/fixtures/grammar.json", import.meta.url), "utf8"),
    )
    for (const { source } of fixtures.accept) {
      assert.deepEqual(await asyncBrowser.parse(source), parse(source), source)
    }
    for (const source of [
      ...fixtures.reject,
      ...fixtures.markupDiagnostics.map(item => item.source),
    ]) {
      let expected
      try {
        expected = parse(source)
      } catch (error) {
        await assert.rejects(asyncBrowser.parse(source), {
          constructor: error.constructor,
          message: error.message,
        })
        continue
      }
      assert.deepEqual(await asyncBrowser.parse(source), expected, source)
    }
  })

  it("loads the same tokenizer for JavaScript blocks, including failures and concurrent calls", async () => {
    const sources = [
      'nodejs(bind="one") { const r = /}/; const t = `x$' +
        '{{v: "}"}.v}`; // }\n return { r, t }; }',
      'nodejs(bind="one") { return 1; }\nnodejs(bind="two") { return 2; }',
      'nodejs(bind="one") { const x = "unterminated',
      'nodejs(bind="one") { return 1;',
      'p { "nodejs(bind=x)" }',
    ]
    await Promise.all(
      sources.map(async source => {
        try {
          const expected = parse(source)
          assert.deepEqual(await asyncBrowser.parse(source), expected)
          assert.deepEqual(
            asyncBrowser.evaluate(await asyncBrowser.parse(source)),
            evaluate(expected),
          )
        } catch (error) {
          assert.ok(error instanceof ProgramSyntaxError)
          await assert.rejects(asyncBrowser.parse(source), {
            constructor: error.constructor,
            message: error.message,
          })
        }
      }),
    )
  })
})
