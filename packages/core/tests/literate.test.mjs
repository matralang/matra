import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
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

test("standard modules resolve preinstalled npm packages from moduleRoot", async () => {
  const moduleRoot = await mkdtemp(join(tmpdir(), "matra-literate-npm-"))
  try {
    const packageDirectory = join(moduleRoot, "node_modules", "matra-test-package")
    await mkdir(packageDirectory, { recursive: true })
    await writeFile(
      join(packageDirectory, "package.json"),
      JSON.stringify({
        name: "matra-test-package",
        type: "module",
        exports: { ".": "./index.js" },
      }),
    )
    await writeFile(
      join(packageDirectory, "index.js"),
      "export const add = (left, right) => left + right\n",
    )
    const source = `---
matra:
  entry: main.matra
  values: [math.js]
---
\`\`\`main.matra
p { math.add(19, 23) }
\`\`\`
\`\`\`math.js
export * from "matra-test-package"
\`\`\`
`
    const bundle = await buildLiterate(source)
    assert.deepEqual(await runLiterate(bundle, { moduleRoot }), {
      tag: "p",
      props: {},
      children: [42],
    })
  } finally {
    await rm(moduleRoot, { recursive: true, force: true })
  }
})

test("Python modules use Pyodide, expose __all__, resolve document modules, and reset per run", async () => {
  const source = `---
matra:
  entry: main.matra
  values: [pkg/calculations.py]
---
\`\`\`main.matra
p {
  pkg.calculations.add(40, pkg.calculations.data.amount);
  pkg.calculations.total(pkg.calculations.data.items);
  pkg.calculations.next_value()
}
\`\`\`
\`\`\`pkg/calculations.py
from math import floor
from .helpers import amount

__all__ = ["add", "data", "total", "next_value"]
data = {"amount": amount, "items": [1, 2]}
counter = 0

def add(left, right):
    return floor(left + right)

def total(values):
    return sum(values)

def next_value():
    global counter
    counter += 1
    return counter
\`\`\`
\`\`\`pkg/helpers.py
amount = 2
\`\`\`
\`\`\`unused.py
not valid Python !
\`\`\`
`
  const bundle = await buildLiterate(source)
  assert.deepEqual(
    bundle.pythonModules.map(block => block.path),
    ["pkg/helpers.py"],
  )
  const expected = { tag: "p", props: {}, children: [42, 3, 1] }
  assert.deepEqual(await runLiterate(bundle), expected)
  assert.deepEqual(await runLiterate(bundle), expected)
})

test("Python build validates syntax, imports, exports, and dependency cycles without executing code", async () => {
  const document = python => `---
matra:
  entry: main.matra
  values: [value.py]
---
\`\`\`main.matra
p { value.answer }
\`\`\`
${python}
`
  const validSource = `\`\`\`value.py
raise RuntimeError("build must not execute Python")
__all__ = ["answer"]
answer = 42
\`\`\`
`
  const bundle = await buildLiterate(document(validSource))
  assert.equal(bundle.values[0].path, "value.py")

  for (const [python, expected] of [
    ["```value.py\n__all__ = ['answer']\nanswer = (\n```\n", "PY_SYNTAX"],
    ["```value.py\n__all__ = ['answer']\nimport requests\nanswer = 1\n```\n", "PY_IMPORT"],
    ["```value.py\n__all__ = ['answer']\n__import__('math')\nanswer = 1\n```\n", "PY_IMPORT"],
    ["```value.py\nanswer = 1\n```\n", "PY_EXPORT"],
    [
      "```value.py\n__all__ = ['answer']\nfrom helper import value\nanswer = value\n```\n```helper.py\nfrom value import answer\nvalue = answer\n```\n",
      "PY_MODULE_CYCLE",
    ],
  ]) {
    await assert.rejects(buildLiterate(document(python)), error => {
      assert.ok(error instanceof LiterateError)
      assert.equal(error.code, expected)
      return true
    })
  }
})

test("Python exports reject unsupported data and asynchronous functions", async () => {
  for (const python of [
    "__all__ = ['value']\nvalue = (1, 2)\n",
    "__all__ = ['value']\nasync def value(): return 1\n",
    "__all__ = ['value']\nvalue = 9007199254740992\n",
    "__all__ = ['missing']\nvalue = 1\n",
  ]) {
    const source = `---
matra:
  entry: main.matra
  values: [value.py]
---
\`\`\`main.matra
p { value.value }
\`\`\`
\`\`\`value.py
${python}\`\`\`
`
    const bundle = await buildLiterate(source)
    await assert.rejects(runLiterate(bundle), error => {
      assert.ok(error instanceof LiterateError)
      assert.equal(error.code, "PY_INITIALIZE")
      return true
    })
  }

  const functionResult = `---
matra:
  entry: main.matra
  values: [value.py]
---
\`\`\`main.matra
p { value.invalid_result() }
\`\`\`
\`\`\`value.py
__all__ = ["invalid_result"]
def invalid_result(): return (1, 2)
\`\`\`
`
  await assert.rejects(runLiterate(await buildLiterate(functionResult)), error => {
    assert.ok(error instanceof LiterateError)
    assert.equal(error.code, "JS_CALL")
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
