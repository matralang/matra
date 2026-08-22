import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { test } from "node:test"

const root = new URL("../../..", import.meta.url)

test("matra-seed compiles a Markdown code block to an executable Wasm module", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-"))
  const input = join(directory, "example.md")
  const output = join(directory, "example.wasm")
  await writeFile(input, [
    "# Example",
    "",
    "```math.matra.program",
    "module math",
    "",
    "fn double(value: i32) -> i32 {",
    "  return value * 2",
    "}",
    "```",
    "",
    "```answer.matra.program",
    "module example",
    "",
    "import math",
    "",
    "struct token {",
    "  kind: i32",
    "  start: i32",
    "  length: i32",
    "}",
    "",
    "fn retain_token(value: token) -> token {",
    "  return value",
    "}",
    "",
    "export fn token_length() -> i32 {",
    "  let value = retain_token(token(20, 21, 22))",
    "  return value.length",
    "}",
    "",
    "export fn first_byte(source: bytes) -> i32 {",
    "  return byte_at(source, 0)",
    "}",
    "",
    "export fn source_length(source: bytes) -> i32 {",
    "  return byte_length(source)",
    "}",
    "",
    "fn first_byte_of(source: bytes) -> i32 {",
    "  return byte_at(source, 0)",
    "}",
    "",
    "export fn forwarded_first_byte(source: bytes) -> i32 {",
    "  return first_byte_of(source)",
    "}",
    "",
    "fn pass_through(source: bytes) -> bytes {",
    "  return source",
    "}",
    "",
    "export fn retain(source: bytes) -> bytes {",
    "  let tree = pass_through(source)",
    "  return tree",
    "}",
    "",
    "export fn array_value() -> i32 {",
    "  let values: [i32] = allocate_i32_array(2)",
    "  array_set(values, 0, 20)",
    "  array_set(values, 1, 22)",
    "  return array_get(values, 0) + array_get(values, 1)",
    "}",
    "",
    "export fn answer(input: i32) -> i32 {",
    "  let doubled = double(input)",
    "  let result: i32 = doubled + 2",
    "  while result < 100 {",
    "    if result == 42 {",
    "      break",
    "    }",
    "    result = result + 1",
    "  }",
    "  if result == 42 {",
    "    return result",
    "  } else {",
    "    return 0",
    "  }",
    "}",
    "```",
    "",
  ].join("\n"))

  try {
    const result = spawnSync(
      "cargo",
      ["run", "--quiet", "--manifest-path", "crates/matra-seed/Cargo.toml", "--", input, output, "--entry", "answer.matra.program"],
      { cwd: root, encoding: "utf8" },
    )
    assert.equal(result.status, 0, result.stderr)

    const module = await WebAssembly.instantiate(await readFile(output))
    assert.equal(module.instance.exports.answer(20), 42)
    assert.ok(module.instance.exports.memory instanceof WebAssembly.Memory)
    new Uint8Array(module.instance.exports.memory.buffer)[16] = 65
    assert.equal(module.instance.exports.first_byte(16, 3), 65)
    assert.equal(module.instance.exports.source_length(16, 3), 3)
    assert.equal(module.instance.exports.forwarded_first_byte(16, 3), 65)
    assert.deepEqual(module.instance.exports.retain(16, 3), [16, 3])
    assert.equal(module.instance.exports.array_value(), 42)
    assert.equal(module.instance.exports.token_length(), 22)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("bootstrap compiler maps an empty source to an empty Wasm module", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-compiler-"))
  const output = join(directory, "compiler.wasm")

  try {
    const result = spawnSync(
      "cargo",
      ["run", "--quiet", "--manifest-path", "crates/matra-seed/Cargo.toml", "--", fileURLToPath(new URL("crates/matra-seed/examples/compiler.md", root)), output, "--entry", "compiler.matra.program"],
      { cwd: root, encoding: "utf8" },
    )
    assert.equal(result.status, 0, result.stderr)

    const module = await WebAssembly.instantiate(await readFile(output))
    const recordPointer = module.instance.exports.compile(0, 0)
    const record = new DataView(module.instance.exports.memory.buffer, recordPointer, 20)
    assert.equal(record.getInt32(0, true), 0)
    const pointer = record.getInt32(4, true)
    const length = record.getInt32(8, true)
    assert.equal(record.getInt32(12, true), 0)
    assert.equal(record.getInt32(16, true), 0)
    assert.equal(length, 8)
    const bytes = new Uint8Array(module.instance.exports.memory.buffer, pointer, length)
    assert.deepEqual([...bytes], [0, 97, 115, 109, 1, 0, 0, 0])
    await WebAssembly.compile(bytes)

    const nextRecordPointer = module.instance.exports.compile(0, 0)
    const nextRecord = new DataView(module.instance.exports.memory.buffer, nextRecordPointer, 20)
    const nextPointer = nextRecord.getInt32(4, true)
    const nextLength = nextRecord.getInt32(8, true)
    assert.equal(nextRecord.getInt32(0, true), 0)
    assert.equal(nextLength, 8)
    assert.notEqual(nextPointer, pointer)
    const nextBytes = new Uint8Array(module.instance.exports.memory.buffer, nextPointer, nextLength)
    assert.deepEqual([...nextBytes], [0, 97, 115, 109, 1, 0, 0, 0])
    assert.equal(typeof module.instance.exports.alloc, "function")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
