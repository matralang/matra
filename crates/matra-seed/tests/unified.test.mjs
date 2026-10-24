import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { instantiateUnified } from "../host/unified-host.mjs"
import { spawnSync } from "./helpers/process.mjs"

const root = new URL("../../..", import.meta.url)
async function compile(source, extension = "matra", entry) {
  const directory = await mkdtemp(join(tmpdir(), "matra-unified-"))
  try {
    const input = join(directory, `source.${extension}`)
    const output = join(directory, "output.wasm")
    await writeFile(input, source)
    const result = spawnSync(
      "cargo",
      [
        "run",
        "--quiet",
        "--manifest-path",
        "crates/matra-seed/Cargo.toml",
        "--",
        input,
        output,
        ...(entry ? ["--entry", entry] : []),
      ],
      { cwd: root, encoding: "utf8" },
    )
    assert.equal(
      result.status,
      0,
      result.stderr || result.error?.message || `Compiler terminated by ${result.signal}`,
    )
    const bytes = await readFile(output)
    assert.equal(WebAssembly.validate(bytes), true)
    return bytes
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
async function run(source) {
  return (await instantiateUnified(await compile(source))).run()
}

test("unified seed preserves the mixed markup document example", async () => {
  const source = await readFile(new URL("../examples/document.matra", import.meta.url), "utf8")
  assert.deepEqual(await run(source), {
    tag: "article",
    props: { lang: "ja", class: "card" },
    children: [
      { tag: "h1", props: {}, children: ["Matra"] },
      {
        tag: "ul",
        props: {},
        children: ["文書", "関数", "Wasm"].map(value => ({
          tag: "li",
          props: {},
          children: [`${value}!`],
        })),
      },
    ],
  })
})

test("unified seed executes documents, member access, classes and data", async () => {
  assert.deepEqual(
    await run(`let page = {title: "日本語", url: "/"}
article.card.card(lang="ja", options={theme: "dark"}, series=[10, 20]) {
  a.link(href=page.url) { page.title }
  [1, 2]
  {value: null}
}`),
    {
      tag: "article",
      props: { lang: "ja", options: { theme: "dark" }, series: [10, 20], class: "card" },
      children: [
        { tag: "a", props: { href: "/", class: "link" }, children: ["日本語"] },
        [1, 2],
        { value: null },
      ],
    },
  )
})

test("unified seed emits explicitly expanded loop results", async () => {
  assert.deepEqual(
    await run(`fn label(value) { return value + "!" }
ul {
  let items = ["one", "two"]
  ...for (item in items) {
    if (item != "") { li { label(item) } }
    else { "unreachable" }
  }
}`),
    {
      tag: "ul",
      props: {},
      children: [
        { tag: "li", props: {}, children: ["one!"] },
        { tag: "li", props: {}, children: ["two!"] },
      ],
    },
  )
})

test("unified seed uses lexical scopes, closures, recursion and null returns", async () => {
  assert.deepEqual(
    await run(`let x = 10
fn outer(x) {
  fn inner(y) { return x + y }
  return inner
}
fn factorial(n) { if (n <= 1) { return 1 }; return n * factorial(n - 1) }
fn empty() { if (true) { return null }; return "wrong" }
let add = outer(2)
[add(3), x, factorial(5), empty()]`),
    [5, 10, 120, null],
  )
})

test("unified seed evaluates precedence, decimals, unary and short circuit", async () => {
  assert.deepEqual(
    await run(
      `[5 - 2, -2 + 3, 1 + 2 * 3 == 7, !(false || false) && true, -(.5 + .25), false && unknown(), true || unknown(), 0 || 9]`,
    ),
    [3, 1, true, true, -0.75, false, true, 9],
  )
})

test("unified seed executes assignment, while, do-until and nested break", async () => {
  assert.deepEqual(
    await run(`let n = 0
let total = 0
while (n < 4) {
  n = n + 1
  do { total = total + 2; break } until (false)
}
do { total = total + 1 } until (total >= 10)
[n, total]`),
    [4, 10],
  )
})

test("unified seed preserves string delimiters and prototype-shaped data keys", async () => {
  assert.deepEqual(
    await run(`let value = {"__proto__": "safe", "constructor": "data"}
p { "}"; ")"; "null"; "if"; value.__proto__; value.constructor }`),
    { tag: "p", props: {}, children: ["}", ")", "null", "if", "safe", "data"] },
  )
})

test("unified host rejects non-array loops and unknown assignments", async () => {
  await assert.rejects(() => run("for (x in 1) { x }"), /Expected an array/)
  await assert.rejects(() => run("x = 2"), /Unknown name/)
  await assert.rejects(() => run("let value = {}\nvalue.constructor"), /Unknown member/)
})

test("unified seed compiles a named document fence and native module imports", async () => {
  const document = await compile(
    '```doc.matra\np { "ok" }\n```\n```ignored.matra\n"ignored"\n```',
    "md",
    "doc.matra",
  )
  assert.deepEqual((await instantiateUnified(document)).run(), {
    tag: "p",
    props: {},
    children: ["ok"],
  })
  const native = await compile(
    `\`\`\`doc.matra
p { "ignored" }
\`\`\`
\`\`\`math.matra
module math
fn twice(x: i32) -> i32 { return x * 2 }
\`\`\`
\`\`\`main.matra
module main
import math
export fn answer() -> i32 { return twice(21) }
\`\`\``,
    "md",
    "main.matra",
  )
  assert.equal((await WebAssembly.instantiate(native)).instance.exports.answer(), 42)
})

test("unified run creates a fresh top-level scope on each call", async () => {
  const program = await instantiateUnified(await compile("let x = 1\nx = x + 1\nx"))
  assert.equal(program.run(), 2)
  assert.equal(program.run(), 2)
})

test("native unified profile executes migrated condition syntax and struct returns", async () => {
  const source = `module sample
struct pair {
  left: i32
  right: i32
}
fn choose(value: pair) -> i32 {
  if (value.left != 0) { return value.left }
  return value.right
}
export fn answer() -> i32 {
  let count = 0
  while (count < 3) { count = count + 1 }
  if (count == 3) { return choose(pair(42, 0)) }
  return 0
}`
  const bytes = await compile(source)
  assert.equal((await WebAssembly.instantiate(bytes)).instance.exports.answer(), 42)
  const { cachedCompiler } = await import("../host/bootstrap-compiler.mjs")
  const { formatCompilerDiagnostic } = await import("../host/compiler-host.mjs")
  const {
    instance: { exports: compiler },
  } = await WebAssembly.instantiate(await readFile(await cachedCompiler()))
  compiler.memory.grow(32)
  const encoded = new TextEncoder().encode(source)
  const pointer = compiler.alloc(encoded.length)
  new Uint8Array(compiler.memory.buffer, pointer, encoded.length).set(encoded)
  const recordPointer = compiler.compile(pointer, encoded.length)
  const record = new DataView(compiler.memory.buffer, recordPointer, 36)
  assert.equal(
    record.getInt32(0, true),
    0,
    formatCompilerDiagnostic(encoded, compiler.memory, recordPointer),
  )
  const output = new Uint8Array(
    compiler.memory.buffer,
    record.getInt32(4, true),
    record.getInt32(8, true),
  )
  assert.equal((await WebAssembly.instantiate(output)).instance.exports.answer(), 42)
})

const conformance = JSON.parse(
  await readFile(new URL("../../../spec/fixtures/unified.json", import.meta.url), "utf8"),
)
test("unified seed reports markup diagnostic byte offsets", async () => {
  for (const { source, offset } of conformance.markupDiagnostics) {
    const byteOffset = Buffer.byteLength(source.slice(0, offset))
    await assert.rejects(
      () => compile(source),
      error => {
        assert.match(error.message, new RegExp(`offset ${byteOffset}\\b`), source)
        return true
      },
    )
  }
})
for (const fixture of conformance.native) {
  test(`native conformance: ${fixture.name}`, async () => {
    for (const [source, extension] of [
      [fixture.source, "matra"],
      [`\`\`\`entry.matra\n${fixture.source}\n\`\`\``, "md"],
    ]) {
      const { instance } = await WebAssembly.instantiate(await compile(source, extension))
      assert.equal(instance.exports.answer(), fixture.value)
    }
  })
}
for (const source of conformance.nativeReject) {
  test(`native rejects: ${source}`, async () => {
    await assert.rejects(
      () => compile(source),
      error => {
        assert.match(error.message, /offset|Reserved word/)
        assert.doesNotMatch(error.message, /panicked|unreachable|out of bounds/i)
        return true
      },
    )
  })
}
for (const fixture of conformance.accept) {
  test(`unified conformance: ${fixture.name}`, async () => {
    assert.deepEqual(await run(fixture.source), fixture.value)
  })
}
for (const source of conformance.reject) {
  test(`unified rejects: ${source}`, async () => {
    await assert.rejects(() => run(source))
  })
}

test("bootstrap CLI reserves document workspace and runs generated Wasm", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-unified-cli-"))
  try {
    const input = join(directory, "source.matra")
    const output = join(directory, "output.wasm")
    await writeFile(
      input,
      `${"// document workspace\n".repeat(500)}fn value(x) { x * 2 }\np { ...for x in [1, 2] { value(x) } }`,
    )
    const result = spawnSync(
      process.execPath,
      ["crates/matra-seed/host/bootstrap.mjs", input, output],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 30000,
      },
    )
    assert.equal(result.status, 0, result.stderr || result.error?.message)
    assert.deepEqual((await instantiateUnified(await readFile(output))).run(), {
      tag: "p",
      props: {},
      children: [2, 4],
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
