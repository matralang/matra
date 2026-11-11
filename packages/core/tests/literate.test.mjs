import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { buildLiterate, LiterateError, runLiterate } from "@matra/core/experimental/literate"

const markdown = `---
matra:
  entry: main.matra
  values: [data.js.part]
---
\`\`\`main.matra
p { data.title }
\`\`\`
\`\`\`data.js.part
({ title: "Hello" })
\`\`\`
`

test("the unpublished non-experimental subpath is not exported", async () => {
  await assert.rejects(import("@matra/core/literate"), {
    code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
  })
})

test("public literate API preserves bundles and creates fresh contexts", async () => {
  const bundle = await buildLiterate(markdown)
  assert.equal(bundle.abi, "matra-value-1")
  const expected = { tag: "p", props: {}, children: ["Hello"] }
  assert.deepEqual(await runLiterate(JSON.parse(JSON.stringify(bundle))), expected)
  assert.deepEqual(await runLiterate(bundle), expected)
})

test("runLiterate injects copied plain-data globals without colliding with value modules", async () => {
  const source = `---
matra:
  entry: main.matra
---
\`\`\`main.matra
p { page.title }
\`\`\`
`
  const bundle = await buildLiterate(source)
  assert.deepEqual(await runLiterate(bundle, { globals: { page: { title: "From host" } } }), {
    tag: "p",
    props: {},
    children: ["From host"],
  })
  await assert.rejects(runLiterate(bundle, { globals: { "invalid-name": true } }), {
    code: "INVALID_GLOBALS",
  })
  const withValue = await buildLiterate(
    source.replace("entry: main.matra", "entry: main.matra\n  values: [page.js.part]") +
      "```page.js.part\n({ title: 'value module' })\n```\n",
  )
  await assert.rejects(runLiterate(withValue, { globals: { page: { title: "host" } } }), {
    code: "GLOBAL_COLLISION",
  })
})

test("YAML metadata is not scanned as executable code fences", async () => {
  const metadata = `---
description: |
  \`\`\`hidden.js.part
  invalid
  \`\`\`
matra:
  entry: main.matra
---
\`\`\`main.matra
p { 1 }
\`\`\`
`
  const bundle = await buildLiterate(metadata.replaceAll("\n", "\r\n"))
  assert.equal(bundle.entry.line, 10)
  assert.deepEqual(bundle.values, [])
  assert.deepEqual(await runLiterate(bundle), { tag: "p", props: {}, children: [1] })
})

test("unsupported bundle ABI and Wasm fail before initializing JavaScript", async () => {
  const bundle = await buildLiterate(markdown)
  bundle.values[0].source = '(() => { throw new Error("must not initialize") })()'
  const wrongExportKind = Buffer.from(
    "0061736d0100000001040160000003020100071002066d656d6f727900000372756e00000a040102000b",
    "hex",
  )
  assert.ok(WebAssembly.validate(wrongExportKind))
  for (const invalid of [
    { ...bundle, abi: "unknown" },
    { ...bundle, wasm: Buffer.from("invalid").toString("base64") },
    { ...bundle, wasm: "AGFzbQEAAAA=" },
    { ...bundle, wasm: wrongExportKind.toString("base64") },
  ]) {
    await assert.rejects(
      runLiterate(invalid),
      error => error instanceof LiterateError && error.code === "INVALID_BUNDLE",
    )
  }
})

test("public errors include document location and build does not execute values", async () => {
  const bundle = await buildLiterate(
    markdown.replace('({ title: "Hello" })', '(() => { throw new Error("runtime only") })()'),
    { document: "example.md" },
  )
  await assert.rejects(runLiterate(bundle), error => {
    assert.ok(error instanceof LiterateError)
    assert.equal(error.code, "JS_INITIALIZE")
    assert.equal(error.document, "example.md")
    assert.equal(error.path, "data.js.part")
    assert.equal(error.line, 10)
    assert.equal(error.cause.message, "runtime only")
    return true
  })
})

test("standard JavaScript modules expose named and default exports through Matra paths", async () => {
  const source = `---
matra:
  entry: main.matra
  values: [analytics.js]
---
\`\`\`main.matra
p { analytics.total([10, 20, 30]) }
\`\`\`
\`\`\`analytics.js
export { default as total } from "./analytics/total.js"
\`\`\`
\`\`\`analytics/total.js
export default function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
\`\`\`
`
  const bundle = await buildLiterate(source)
  assert.deepEqual(
    bundle.modules.map(block => block.path),
    ["analytics/total.js"],
  )
  assert.deepEqual(await runLiterate(bundle), {
    tag: "p",
    props: {},
    children: [60],
  })

  const defaultModule = `---
matra:
  entry: main.matra
  values: [analytics/total.js]
---
\`\`\`main.matra
p { analytics.total(3) }
\`\`\`
\`\`\`analytics/total.js
export default value => value * 2
\`\`\`
`
  assert.deepEqual(await runLiterate(await buildLiterate(defaultModule)), {
    tag: "p",
    props: {},
    children: [6],
  })
})

test("module build validates relative dependencies without evaluating module code", async () => {
  const source = `---
matra:
  entry: main.matra
  values: [value.js]
---
\`\`\`main.matra
p { value.answer }
\`\`\`
\`\`\`value.js
import { answer } from "./answer.js"
export { answer }
\`\`\`
\`\`\`answer.js
throw new Error("module initialization")
export const answer = 42
\`\`\`
`
  const bundle = await buildLiterate(source)
  assert.deepEqual(
    bundle.modules.map(block => block.path),
    ["answer.js"],
  )
  await assert.rejects(runLiterate(bundle), error => {
    assert.ok(error instanceof LiterateError)
    assert.equal(error.code, "JS_INITIALIZE")
    assert.equal(error.path, "value.js")
    assert.match(error.cause.message, /module initialization/)
    return true
  })
})

test("standard module imports reject unsupported specifiers, cycles, async initialization, and mixed exports", async () => {
  const document = body => `---
matra:
  entry: main.matra
  values: [value.js]
---
\`\`\`main.matra
p { value.answer }
\`\`\`
${body}
`
  for (const [body, expected] of [
    ["```value.js\nimport fs from 'node:fs'\nexport { fs }\n```\n", "UNSUPPORTED_IMPORT"],
    ["```value.js\nexport const answer = await Promise.resolve(1)\n```\n", "UNSUPPORTED_ASYNC"],
    [
      "```value.js\nimport './dep.js'\nexport const answer = 1\n```\n```dep.js\nimport './value.js'\n```\n",
      "MODULE_CYCLE",
    ],
    ["```value.js\nexport default 1\nexport const answer = 2\n```\n", "MIXED_EXPORTS"],
    ["```value.js\nexport const answer = import('./dep.js')\n```\n", "UNSUPPORTED_IMPORT"],
  ]) {
    await assert.rejects(buildLiterate(document(body)), error => {
      assert.ok(error instanceof LiterateError)
      assert.equal(error.code, expected)
      return true
    })
  }
})

test("ordinary Core import does not load the Node literate host", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'import core from "@matra/core"; if (!core.parse) process.exit(1)',
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8", env: process.env },
  )
  assert.equal(result.status, 0, result.stderr)
})
