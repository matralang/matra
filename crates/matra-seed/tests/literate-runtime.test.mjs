import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import {
  buildLiterate,
  LiterateError,
  registerLiterate,
  runLiterate,
} from "../host/literate-runtime.mjs"
import { spawnSync } from "./helpers/process.mjs"

const sample = new URL("../examples/literate-values.md", import.meta.url)
const cli = fileURLToPath(new URL("../host/literate.mjs", import.meta.url))
const fence = (path, source) => `\`\`\`${path}\n${source}\n\`\`\`\n`
const frontMatter = (entry = "main.matra", values = []) =>
  `---\nmatra:\n  entry: ${JSON.stringify(entry)}\n  values: ${
    values.length ? `\n${values.map(value => `    - ${JSON.stringify(value)}`).join("\n")}` : "[]"
  }\n---\n`
const withFrontMatter = (markdown, entry = "main.matra", values = []) =>
  frontMatter(entry, values) + markdown
const document = (source, parts = {}) =>
  withFrontMatter(
    fence("main.matra", source) +
      Object.entries(parts)
        .map(([path, body]) => fence(path, body))
        .join("\n"),
    "main.matra",
    Object.keys(parts),
  )
const options = () => ({ document: "guide.md" })
const code = expected => error => error instanceof LiterateError && error.code === expected
const build = (source, parts = {}) => buildLiterate(document(source, parts), options())

test("front matter selects the entry and values independent of block order", async () => {
  const markdown = await readFile(sample, "utf8")
  const bundle = await buildLiterate(markdown, options())
  assert.equal(WebAssembly.validate(Buffer.from(bundle.wasm, "base64")), true)
  const expected = {
    tag: "article",
    props: {},
    children: [
      { tag: "h1", props: {}, children: ["Sales"] },
      { tag: "p", props: {}, children: [60] },
      {
        tag: "ul",
        props: {},
        children: [
          { tag: "li", props: {}, children: ["A", 10] },
          { tag: "li", props: {}, children: ["B", 20] },
          { tag: "li", props: {}, children: ["C", 30] },
        ],
      },
    ],
  }
  assert.deepEqual(await runLiterate(JSON.parse(JSON.stringify(bundle))), expected)
  const registered = registerLiterate(markdown, options())
  const reordered = [...registered.values, registered.entry]
    .reverse()
    .map(block => fence(block.path, block.source))
    .join("\n")
  assert.deepEqual(
    await runLiterate(
      await buildLiterate(
        withFrontMatter(reordered, "main.matra", [
          "analytics/total.js.part",
          "datasets/sales.js.part",
        ]),
        options(),
      ),
    ),
    expected,
  )
})

test("registration rejects duplicate paths, ambiguous public names, invalid paths and selections", () => {
  const main = document("p { 1 }")
  for (const [extra, expected] of [
    [fence("main.matra", "2"), "DUPLICATE_PATH"],
    [fence("MAIN.matra", "2"), "DUPLICATE_PATH"],
    [fence("a.js", "export default 1") + fence("a.js.part", "1"), "PUBLIC_NAME_COLLISION"],
    [fence("a.js.part", "{}") + fence("a/b.js.part", "1"), "PUBLIC_NAME_COLLISION"],
    [fence("../a.js.part", "1"), "INVALID_PATH"],
    [fence("/a.js.part", "1"), "INVALID_PATH"],
    [fence("a\\b.js.part", "1"), "INVALID_PATH"],
    [fence("a.js.part?x", "x"), "UNSUPPORTED_FORMAT"],
    ["```open.js.part\n1", "UNCLOSED_FENCE"],
  ]) {
    assert.throws(() => registerLiterate(main + extra, options()), code(expected))
  }
  assert.throws(
    () =>
      registerLiterate(withFrontMatter(fence("main.matra", "p { 1 }"), "missing.matra"), options()),
    code("NOT_FOUND"),
  )
  assert.throws(
    () =>
      registerLiterate(
        withFrontMatter(fence("main.matra", "p { 1 }"), "main.matra", ["missing.js.part"]),
        options(),
      ),
    code("NOT_FOUND"),
  )
  for (const path of ["module.js", "value.py", "a.partial.js"]) {
    const markdown = document("p { 1 }", { [path]: "42" })
    assert.throws(
      () => registerLiterate(markdown, options()),
      code(path === "a.partial.js" ? "INVALID_PATH" : "UNSUPPORTED_FORMAT"),
    )
  }
  const markdown = document("p { x }", { "x.js.part": "1" })
  assert.throws(
    () =>
      registerLiterate(
        withFrontMatter(fence("main.matra", "p { x }") + fence("x.js.part", "1"), "main.matra", [
          "x.js.part",
          "x.js.part",
        ]),
        options(),
      ),
    code("DUPLICATE_SELECTION"),
  )
  assert.throws(
    () => registerLiterate(markdown, { ...options(), entry: "x.js.part" }),
    code("INVALID_OPTIONS"),
  )
})

test("front matter is required, parsed as YAML and validated", () => {
  for (const markdown of [
    fence("main.matra", "p {}"),
    "---\nmatra:\n  entry: main.matra\n",
    "---\nmatra: [\n---\n" + fence("main.matra", "p {}"),
    "---\nmatra:\n  entry: 42\n---\n" + fence("main.matra", "p {}"),
    "---\nmatra:\n  entry: main.matra\n  values: invalid\n---\n" + fence("main.matra", "p {}"),
    "---\nmatra:\n  entry: main.matra\n  values: null\n---\n" + fence("main.matra", "p {}"),
  ]) {
    assert.throws(
      () => registerLiterate(markdown, options()),
      error => ["FRONTMATTER_REQUIRED", "INVALID_FRONTMATTER"].includes(error.code),
    )
  }
})

test("omitted matra.values leaves named value blocks unselected", async () => {
  const markdown =
    "---\nmatra:\n  entry: main.matra\n---\n" +
    fence("main.matra", "p { 1 }") +
    fence("unused.js.part", '(() => { throw new Error("must remain unused") })()')
  const registration = registerLiterate(markdown, options())
  assert.deepEqual(registration.values, [])
  assert.deepEqual(await runLiterate(await buildLiterate(markdown, options())), {
    tag: "p",
    props: {},
    children: [1],
  })
})

test("fence collection handles CRLF, comments, delimiters, nested examples and source positions", async () => {
  const markdown = [
    "# Guide",
    "````markdown",
    "```hidden.js.part",
    "invalid",
    "```",
    "````",
    "   ~~~~data.js.part   ",
    "/* comment */",
    '{ title: "ok", n: 2 } // trailing comment',
    "  ~~~~~\t",
    "```javascript",
    'throw new Error("example")',
    "```",
    "```ignored.js.part",
    "invalid JavaScript",
    "```",
    "```main.matra",
    "p { data.title; data.n }",
    "```",
  ].join("\r\n")
  const withMetadata = withFrontMatter(markdown, "main.matra", ["data.js.part"])
  const registration = registerLiterate(withMetadata, options())
  assert.equal(registration.entry.line, 24)
  assert.equal(registration.values[0].line, 14)
  assert.deepEqual(await runLiterate(await buildLiterate(withMetadata, options())), {
    tag: "p",
    props: {},
    children: ["ok", 2],
  })
})

test("expression syntax has no module, statement or semicolon fallback", () => {
  for (const source of [
    "export default 1",
    "import x from 'x'",
    "return 1",
    "1; 2",
    "42;",
    "{",
    "",
  ]) {
    assert.throws(
      () => registerLiterate(document("data", { "data.js.part": source }), options()),
      code("JS_SYNTAX"),
      source,
    )
  }
})

test("build never initializes user values, runtime initializes once in path order and resets each run", async () => {
  const bundle = await build("p { a(); a(); z }", {
    "z.js.part": "globalThis.counter",
    "a.js.part": "(() => { globalThis.counter = 10; return () => ++globalThis.counter })()",
  })
  const expected = { tag: "p", props: {}, children: [11, 12, 10] }
  assert.deepEqual(await runLiterate(bundle), expected)
  assert.deepEqual(await runLiterate(bundle), expected)
  const failing = await build("p { data }", {
    "data.js.part": '(() => { throw new Error("initialization failed") })()',
  })
  await assert.rejects(
    () => runLiterate(failing),
    error => {
      assert.ok(code("JS_INITIALIZE")(error))
      assert.match(error.message, /guide.md:11:1 \(data.js.part\).*initialization failed/)
      assert.match(error.cause.stack, /guide.md \(data.js.part\):11:\d+/)
      return true
    },
  )
})

test("data and nested functions cross the boundary; arguments and return values are copied", async () => {
  const bundle = await build(
    `let original = [10, 20, 30]
p { data.title; data.flag; data.none; data.n; api.sum(original); api.mutate(original); ...original; api.thisValue() }`,
    {
      "data.js.part": '{title: "Sales", flag: true, none: null, n: 0.1}',
      "api.js.part": `({
      sum: function (values) { return values.reduce((a, b) => a + b, 0) },
      mutate: values => { values[0] = 99; return values[0] },
      thisValue: function () { return this === undefined }
    })`,
    },
  )
  assert.deepEqual(await runLiterate(bundle), {
    tag: "p",
    props: {},
    children: ["Sales", true, null, 0.1, 60, 99, 10, 20, 30, true],
  })
  const node = await build('p { identity(p { "child" }) }', { "identity.js.part": "x => x" })
  assert.deepEqual(await runLiterate(node), {
    tag: "p",
    props: {},
    children: [{ tag: "p", props: {}, children: ["child"] }],
  })
  const snapshots = await build("p { data.n; api.set(); data.n; api.get() }", {
    "data.js.part": "(globalThis.shared = {n: 1})",
    "api.js.part": "({set: () => (globalThis.shared.n = 2), get: () => globalThis.shared.n})",
  })
  assert.deepEqual(await runLiterate(snapshots), {
    tag: "p",
    props: {},
    children: [1, 2, 1, 2],
  })
  const aliases = await build("p { api.same(data) }", {
    "data.js.part": "(() => { const shared = {}; return {a: shared, b: shared} })()",
    "api/same.js.part": "x => x.a === x.b",
  })
  assert.deepEqual(await runLiterate(aliases), { tag: "p", props: {}, children: [false] })
})

test("unsupported values fail at initialization and call boundaries", async () => {
  const base = await build("p { value }", { "value.js.part": "1" })
  for (const source of [
    "undefined",
    "1n",
    "NaN",
    "Infinity",
    "new Date()",
    "new Uint8Array([1])",
    "Promise.resolve(1)",
    'Promise.reject(new Error("rejected"))',
    "({then() {}})",
    "(() => { Object.prototype.then = () => {}; return {} })()",
    "({get x() {throw new Error('must not run getter')}})",
    "({[Symbol()]: 1})",
    "Object.defineProperty({}, 'x', {value: 1})",
    "[, 1]",
    "Object.assign([1], {extra: 2})",
    "Object.setPrototypeOf([1], {})",
    "(() => { const x = {}; x.x = x; return x })()",
    "new Proxy({}, {})",
  ]) {
    const bundle = structuredClone(base)
    bundle.values[0].source = source
    await assert.rejects(() => runLiterate(bundle), code("UNSUPPORTED_VALUE"), source)
  }
  const callable = await build("p { value() }", { "value.js.part": "() => 1" })
  for (const source of [
    "() => undefined",
    "async () => 1",
    "() => Promise.reject('no')",
    "() => import('node:fs')",
  ]) {
    const bundle = structuredClone(callable)
    bundle.values[0].source = source
    await assert.rejects(() => runLiterate(bundle), code("UNSUPPORTED_VALUE"), source)
  }
  const callback = await build("fn local() { return 1 }\np { value(local) }", {
    "value.js.part": "fn => fn()",
  })
  await assert.rejects(() => runLiterate(callback), code("UNSUPPORTED_VALUE"))
})

test("the JavaScript context exposes no Node globals and rejects string code generation", async () => {
  const globals = await build("p { ...value() }", {
    "value.js.part": "() => [typeof process, typeof require, typeof setTimeout]",
  })
  assert.deepEqual(await runLiterate(globals), {
    tag: "p",
    props: {},
    children: ["undefined", "undefined", "undefined"],
  })
  const evaluation = await build("p { value() }", { "value.js.part": '() => eval("1")' })
  await assert.rejects(() => runLiterate(evaluation), code("JS_CALL"))
})

test("compile, missing member, non-function, binding collision and JavaScript errors remain explicit", async () => {
  await assert.rejects(
    () => buildLiterate(withFrontMatter("# Title\n\n" + fence("main.matra", "let =")), options()),
    error => code("MATRA_COMPILE")(error) && /guide.md:\d+:/.test(error.message),
  )
  for (const source of ["value()", "value.missing", "let value = 1\nvalue"]) {
    const bundle = await build(source, { "value.js.part": "{}" })
    await assert.rejects(() => runLiterate(bundle), code("MATRA_RUNTIME"))
  }
  for (const thrown of ['new Error("call failed")', '"string failure"', "null"]) {
    const bundle = await build("p { value() }", {
      "value.js.part": `() => { throw ${thrown} }`,
    })
    await assert.rejects(() => runLiterate(bundle), code("JS_CALL"))
  }
  const functionOutput = await build("value", { "value.js.part": "() => 1" })
  await assert.rejects(() => runLiterate(functionOutput), code("UNSUPPORTED_VALUE"))
  await assert.rejects(() => runLiterate({ format: "unknown" }), code("INVALID_BUNDLE"))
})

test("CLI persists build without executing, runs the bundle and reports failures with nonzero status", async t => {
  const root = await mkdtemp(join(tmpdir(), "matra literate 日本語 "))
  t.after(() => rm(root, { recursive: true, force: true }))
  const invoke = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" })
  await writeFile(join(root, "guide.md"), await readFile(sample))
  const built = invoke("build", root, "guide.md", "result.json")
  assert.equal(built.status, 0, built.stderr)
  const run = invoke("run", root, "result.json")
  assert.equal(run.status, 0, run.stderr)
  assert.equal(JSON.parse(run.stdout).children[1].children[0], 60)
  const overwritten = invoke("build", root, "guide.md", "guide.md")
  assert.equal(overwritten.status, 1)
  assert.match(overwritten.stderr, /overwrite/)
  await writeFile(
    join(root, "throw.md"),
    document("p { value }", {
      "value.js.part": '(() => { throw new Error("runtime only") })()',
    }),
  )
  const deferred = invoke("build", root, "throw.md", "throw.json")
  assert.equal(deferred.status, 0, deferred.stderr)
  const failed = invoke("run", root, "throw.json")
  assert.equal(failed.status, 1)
  assert.match(failed.stderr, /JS_INITIALIZE: throw.md:11:1 \(value.js.part\).*runtime only/)
  assert.equal(failed.stdout, "")
})
