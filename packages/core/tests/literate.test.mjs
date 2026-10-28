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
