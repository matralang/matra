import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { cachedCompiler } from "../host/bootstrap-compiler.mjs"
import { formatCompilerDiagnostic } from "../host/compiler-host.mjs"

const root = fileURLToPath(new URL("../../../", import.meta.url))

async function seed(source) {
  const directory = await mkdtemp(join(tmpdir(), "matra-struct-lifetime-"))
  try {
    const input = join(directory, "input.md")
    const output = join(directory, "output.wasm")
    await writeFile(input, "```compiler.matra.program\n" + source + "\n```\n")
    const result = spawnSync("cargo", ["run", "--quiet", "--manifest-path", "crates/matra-seed/Cargo.toml", "--", input, output], { cwd: root, encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    return await readFile(output)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function bootstrap(source) {
  const { instance: { exports: compiler } } = await WebAssembly.instantiate(await readFile(await cachedCompiler()))
  compiler.memory.grow(32)
  const bytes = new TextEncoder().encode(source)
  const pointer = compiler.alloc(bytes.length)
  new Uint8Array(compiler.memory.buffer, pointer, bytes.length).set(bytes)
  const result = compiler.compile(pointer, bytes.length)
  const record = new DataView(compiler.memory.buffer, result, 36)
  assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(bytes, compiler.memory, result))
  return new Uint8Array(compiler.memory.buffer, record.getInt32(4, true), record.getInt32(8, true)).slice()
}

for (const [name, compile] of [["seed", seed], ["bootstrap", bootstrap]]) {
  test(`${name} preserves array local pointer and length slots`, async () => {
    const source = `module demo
fn make() -> [i32] {
  let values = allocate_i32_array(2)
  array_set(values, 0, 42)
  return values
}
export fn probe() -> i32 {
  let values = make()
  return array_get(values, 0)
}
`
    const { instance: { exports: generated } } = await WebAssembly.instantiate(await compile(source))
    assert.equal(generated.probe(), 42)
  })

  test(`${name} materializes flat metadata after scalar extraction`, async () => {
    const markdown = await readFile(new URL("../examples/compiler.md", import.meta.url), "utf8")
    const program = markdown.split("```compiler.matra.program\n")[1]
    const source = program.slice(0, program.indexOf("// A temporary execution probe")) + `
fn metadata(source: bytes, offset: i32) -> [i32] {
  let value = next_token(source, offset)
  let kind = value.kind
  let start = value.start
  let length = value.length
  let record = allocate_i32_array(3)
  array_set(record, 0, kind)
  array_set(record, 1, start)
  array_set(record, 2, length)
  return record
}
export fn probe(source: bytes) -> i32 {
  let record = metadata(source, 7)
  let kind = array_get(record, 0)
  let start = array_get(record, 1)
  let length = array_get(record, 2)
  let result = kind + start
  result = result + length
  return result
}
`
    const { instance: { exports: generated } } = await WebAssembly.instantiate(await compile(source))
    const bytes = new TextEncoder().encode("module compiler\n\nstruct")
    new Uint8Array(generated.memory.buffer, 4096, bytes.length).set(bytes)
    assert.equal(generated.probe(4096, bytes.length), 16)
  })

  test(`${name} materializes flat metadata from scalar fields`, async () => {
    const source = `module demo
fn metadata(source: bytes) -> [i32] {
  let status = 1
  let position = 40
  let record = allocate_i32_array(2)
  array_set(record, 0, status)
  array_set(record, 1, position)
  let ignored = allocate_i32_array(1)
  return record
}
export fn probe(source: bytes) -> i32 {
  let record = metadata(source)
  let status = array_get(record, 0)
  let position = array_get(record, 1)
  return status + position
}
`
    const { instance: { exports: generated } } = await WebAssembly.instantiate(await compile(source))
  assert.equal(generated.probe(0, 0), 41)
  })

  test(`${name} preserves consecutive lexer results and aliases`, async () => {
    const markdown = await readFile(new URL("../examples/compiler.md", import.meta.url), "utf8")
    const program = markdown.split("```compiler.matra.program\n")[1]
    const source = program.slice(0, program.indexOf("// A temporary execution probe")) + `
export fn probe(source: bytes, selected: i32) -> token {
  let first = next_token(source, 0)
  let alias = first
  let second = next_token(source, first.start + first.length)
  let third = next_token(source, second.start + second.length)
  if selected == 0 { return alias }
  if selected == 1 { return second }
  return third
}
`
    const { instance: { exports: generated } } = await WebAssembly.instantiate(await compile(source))
    const bytes = new TextEncoder().encode("module compiler\n\nstruct")
    new Uint8Array(generated.memory.buffer, 4096, bytes.length).set(bytes)
    const fields = pointer => [0, 4, 8].map(offset => new DataView(generated.memory.buffer).getInt32(pointer + offset, true))
    const pointers = [0, 1, 2].map(selected => generated.probe(4096, bytes.length, selected))
    assert.deepEqual(pointers.map(fields), [[1, 0, 6], [1, 7, 8], [1, 17, 6]])
    assert.equal(new Set(pointers).size, 3)
  })

  test(`${name} reclaims temporary frames without reclaiming escaped allocations`, async () => {
    const source = `module demo
struct pair { left: i32 right: i32 }
export fn heap() -> i32 { let empty = allocate_bytes(0) return byte_pointer(empty) }
fn make(value: i32) -> pair { let current = value return pair(current, value + 1) }
fn read(value: i32) -> i32 { let pair_value = make(value) return pair_value.right }
export fn nested() -> pair { let first = 20 return pair(read(first), read(40)) }
export fn scalar(value: i32) -> i32 {
  let first = make(value)
  let second = make(value + 2)
  return first.left + second.right
}
export fn recursive(depth: i32) -> pair {
  if depth == 0 { return pair(20, 22) }
  let previous = recursive(depth - 1)
  return pair(previous.left + 1, previous.right + 2)
}
export fn retain(value: pair) -> pair { let alias = value return alias }
fn allocate_result() -> i32 {
  let output = allocate_bytes(1)
  byte_set(output, 0, 99)
  return byte_pointer(output)
}
export fn escape() -> i32 { let temporary = make(7) return allocate_result() }
`
    const { instance: { exports: e } } = await WebAssembly.instantiate(await compile(source))
    const initial = e.heap()
    for (let value = 0; value < 20000; value++) assert.equal(e.scalar(value), value * 2 + 3)
    assert.equal(e.heap(), initial)
    const fields = address => [0, 4].map(offset => new DataView(e.memory.buffer).getInt32(address + offset, true))
    const nested = e.nested()
    assert.deepEqual(fields(nested), [21, 41])
    assert.equal(e.heap(), initial + 8)
    const recursive = e.recursive(100)
    assert.deepEqual(fields(recursive), [120, 222])
    assert.equal(e.heap(), initial + 16)
    assert.equal(e.retain(nested), nested)
    assert.equal(e.heap(), initial + 16)
    const escaped = e.escape()
    assert.equal(e.scalar(1000), 2003)
    assert.equal(new Uint8Array(e.memory.buffer)[escaped], 99)
    assert.deepEqual(fields(nested), [21, 41])
    assert.deepEqual(fields(recursive), [120, 222])
  })
}

test("seed evaluates constructor arguments before reserving its result", async () => {
  const source = `module demo
struct pair { left: i32 right: i32 }
fn make(value: i32) -> pair { return pair(value, value + 1) }
export fn answer() -> pair { return pair(make(20).right, make(40).right) }
`
  const { instance: { exports: generated } } = await WebAssembly.instantiate(await seed(source))
  const pointer = generated.answer()
  const result = new DataView(generated.memory.buffer, pointer, 8)
  assert.deepEqual([result.getInt32(0, true), result.getInt32(4, true)], [21, 41])
})

test("bootstrap preserves the else branch after a struct field comparison", async () => {
  const source = `module demo
struct token { kind: i32 }
export fn choose(value: token) -> i32 {
  let result = 0
  if value.kind == 2 { result = 20 } else { result = 42 }
  return result
}`
  const { instance: { exports: generated } } = await WebAssembly.instantiate(await bootstrap(source))
  const view = new DataView(generated.memory.buffer)
  for (const [kind, expected] of [[1, 42], [2, 20]]) {
    view.setInt32(4096, kind, true)
    assert.equal(generated.choose(4096), expected)
  }
})
