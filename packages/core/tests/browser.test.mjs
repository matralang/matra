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

const dist = fileURLToPath(new URL("../dist/", import.meta.url))
const packageJSON = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

describe("browser entry point", () => {
  it("is a public package subpath", () => {
    assert.equal(packageJSON.exports["./browser"].import, "./dist/browser.js")
    assert.equal(packageJSON.exports["./browser"].types, "./dist/browser.d.ts")
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
    const pending = [join(dist, "browser.js")]

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
})
