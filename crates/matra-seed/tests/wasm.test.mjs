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

    const whitespacePointer = module.instance.exports.alloc(3)
    new Uint8Array(module.instance.exports.memory.buffer, whitespacePointer, 3).fill(32)
    const whitespaceRecordPointer = module.instance.exports.compile(whitespacePointer, 3)
    const whitespaceRecord = new DataView(module.instance.exports.memory.buffer, whitespaceRecordPointer, 20)
    assert.equal(whitespaceRecord.getInt32(0, true), 0)
    assert.equal(whitespaceRecord.getInt32(8, true), 8)

    const identifierPointer = module.instance.exports.alloc(8)
    new Uint8Array(module.instance.exports.memory.buffer, identifierPointer, 8).set(
      new TextEncoder().encode("  token7"),
    )
    assert.equal(module.instance.exports.token_summary(identifierPointer, 8), 1206)

    const integerPointer = module.instance.exports.alloc(5)
    new Uint8Array(module.instance.exports.memory.buffer, integerPointer, 5).set(
      new TextEncoder().encode("\n1234"),
    )
    assert.equal(module.instance.exports.token_summary(integerPointer, 5), 2104)

    const commentPointer = module.instance.exports.alloc(10)
    new Uint8Array(module.instance.exports.memory.buffer, commentPointer, 10).set(
      new TextEncoder().encode("// note\nid"),
    )
    assert.equal(module.instance.exports.token_summary(commentPointer, 10), 1802)

    const programPointer = module.instance.exports.alloc(23)
    new Uint8Array(module.instance.exports.memory.buffer, programPointer, 23).set(
      new TextEncoder().encode("module demo\nimport math"),
    )
    const programRecordPointer = module.instance.exports.compile(programPointer, 23)
    const programRecord = new DataView(module.instance.exports.memory.buffer, programRecordPointer, 20)
    assert.equal(programRecord.getInt32(0, true), 0)
    assert.equal(programRecord.getInt32(8, true), 8)

    const invalidProgramPointer = module.instance.exports.alloc(22)
    new Uint8Array(module.instance.exports.memory.buffer, invalidProgramPointer, 22).set(
      new TextEncoder().encode("module demo import 123"),
    )
    const invalidProgramRecordPointer = module.instance.exports.compile(invalidProgramPointer, 22)
    const invalidProgramRecord = new DataView(module.instance.exports.memory.buffer, invalidProgramRecordPointer, 20)
    assert.equal(invalidProgramRecord.getInt32(0, true), 1)

    const functionSource = new TextEncoder().encode("module demo\nfn answer() -> i32 { return 42 }")
    const functionPointer = module.instance.exports.alloc(functionSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, functionPointer, functionSource.length).set(functionSource)
    const functionRecordPointer = module.instance.exports.compile(functionPointer, functionSource.length)
    const functionRecord = new DataView(module.instance.exports.memory.buffer, functionRecordPointer, 20)
    assert.equal(functionRecord.getInt32(0, true), 0)
    const functionOutputPointer = functionRecord.getInt32(4, true)
    const functionOutputLength = functionRecord.getInt32(8, true)
    const functionOutput = new Uint8Array(module.instance.exports.memory.buffer, functionOutputPointer, functionOutputLength)
    const compiledFunction = await WebAssembly.instantiate(functionOutput)
    assert.equal(compiledFunction.instance.exports.answer(), 42)

    const largeFunctionSource = new TextEncoder().encode("module demo\nfn value() -> i32 { return 123456 }")
    const largeFunctionPointer = module.instance.exports.alloc(largeFunctionSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, largeFunctionPointer, largeFunctionSource.length).set(largeFunctionSource)
    const largeFunctionRecordPointer = module.instance.exports.compile(largeFunctionPointer, largeFunctionSource.length)
    const largeFunctionRecord = new DataView(module.instance.exports.memory.buffer, largeFunctionRecordPointer, 20)
    const largeFunctionOutputPointer = largeFunctionRecord.getInt32(4, true)
    const largeFunctionOutputLength = largeFunctionRecord.getInt32(8, true)
    const largeFunctionOutput = new Uint8Array(module.instance.exports.memory.buffer, largeFunctionOutputPointer, largeFunctionOutputLength)
    const compiledLargeFunction = await WebAssembly.instantiate(largeFunctionOutput)
    assert.equal(compiledLargeFunction.instance.exports.value(), 123456)

    const parameterFunctionSource = new TextEncoder().encode("module demo\nfn identity(value: i32) -> i32 { return value }")
    const parameterFunctionPointer = module.instance.exports.alloc(parameterFunctionSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, parameterFunctionPointer, parameterFunctionSource.length).set(parameterFunctionSource)
    const parameterFunctionRecordPointer = module.instance.exports.compile(parameterFunctionPointer, parameterFunctionSource.length)
    const parameterFunctionRecord = new DataView(module.instance.exports.memory.buffer, parameterFunctionRecordPointer, 20)
    assert.equal(parameterFunctionRecord.getInt32(0, true), 0)
    const parameterFunctionOutputPointer = parameterFunctionRecord.getInt32(4, true)
    const parameterFunctionOutputLength = parameterFunctionRecord.getInt32(8, true)
    const parameterFunctionOutput = new Uint8Array(module.instance.exports.memory.buffer, parameterFunctionOutputPointer, parameterFunctionOutputLength)
    const compiledParameterFunction = await WebAssembly.instantiate(parameterFunctionOutput)
    assert.equal(compiledParameterFunction.instance.exports.identity(42), 42)

    const callFunctionSource = new TextEncoder().encode("module demo\nfn helper() -> i32 { return 42 }\nfn answer() -> i32 { return helper() }")
    const callFunctionPointer = module.instance.exports.alloc(callFunctionSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, callFunctionPointer, callFunctionSource.length).set(callFunctionSource)
    const callFunctionRecordPointer = module.instance.exports.compile(callFunctionPointer, callFunctionSource.length)
    const callFunctionRecord = new DataView(module.instance.exports.memory.buffer, callFunctionRecordPointer, 20)
    assert.equal(callFunctionRecord.getInt32(0, true), 0)
    const callFunctionOutputPointer = callFunctionRecord.getInt32(4, true)
    const callFunctionOutputLength = callFunctionRecord.getInt32(8, true)
    const callFunctionOutput = new Uint8Array(module.instance.exports.memory.buffer, callFunctionOutputPointer, callFunctionOutputLength)
    const compiledCallFunction = await WebAssembly.instantiate(callFunctionOutput)
    assert.equal(compiledCallFunction.instance.exports.answer(), 42)

    const unsupportedFunctionSource = new TextEncoder().encode("module demo\nfn first() -> i32 { return 1 }\nfn second() -> i32 { return 2 }")
    const unsupportedFunctionPointer = module.instance.exports.alloc(unsupportedFunctionSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, unsupportedFunctionPointer, unsupportedFunctionSource.length).set(unsupportedFunctionSource)
    const unsupportedFunctionRecordPointer = module.instance.exports.compile(unsupportedFunctionPointer, unsupportedFunctionSource.length)
    const unsupportedFunctionRecord = new DataView(module.instance.exports.memory.buffer, unsupportedFunctionRecordPointer, 20)
    assert.equal(unsupportedFunctionRecord.getInt32(0, true), 1)

    const invalidFunctionSource = new TextEncoder().encode("module demo\nfn answer() -> i32 { return value }")
    const invalidFunctionPointer = module.instance.exports.alloc(invalidFunctionSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, invalidFunctionPointer, invalidFunctionSource.length).set(invalidFunctionSource)
    const invalidFunctionRecordPointer = module.instance.exports.compile(invalidFunctionPointer, invalidFunctionSource.length)
    const invalidFunctionRecord = new DataView(module.instance.exports.memory.buffer, invalidFunctionRecordPointer, 20)
    assert.equal(invalidFunctionRecord.getInt32(0, true), 1)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
