import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { formatCompilerDiagnostic, sourceExcerpt, sourcePosition } from "../host/compiler-host.mjs"

const root = new URL("../../..", import.meta.url)

test("host maps UTF-8 byte offsets to line and column", () => {
  const source = new TextEncoder().encode("alpha α\nvalue")
  const offset = new TextEncoder().encode("alpha α\n").length
  assert.deepEqual(sourcePosition(source, offset), { line: 2, column: 1 })
})

test("host highlights UTF-8 source ranges with tabs", () => {
  const source = new TextEncoder().encode("module demo\n\treturn αvalue")
  const offset = new TextEncoder().encode("module demo\n\treturn α").length
  const length = new TextEncoder().encode("value").length
  assert.deepEqual(sourceExcerpt(source, offset, length), {
    line: 2,
    column: 13,
    excerpt: "    return αvalue",
    underline: "            ^^^^^",
  })

  const trailingTabSource = new TextEncoder().encode("α\tvalue")
  const trailingTabOffset = new TextEncoder().encode("α\t").length
  assert.deepEqual(sourceExcerpt(trailingTabSource, trailingTabOffset, length), {
    line: 1,
    column: 5,
    excerpt: "α   value",
    underline: "    ^^^^^",
  })
})

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

    const hostInput = join(directory, "host-input.matra")
    const hostOutput = join(directory, "host-output.wasm")
    await writeFile(hostInput, "module demo\nfn answer() -> i32 { return 42 }")
    const hostResult = spawnSync("node", ["crates/matra-seed/host/compile.mjs", output, hostInput, hostOutput], { cwd: root, encoding: "utf8" })
    assert.equal(hostResult.status, 0, hostResult.stderr)
    const hostedModule = await WebAssembly.instantiate(await readFile(hostOutput))
    assert.equal(hostedModule.instance.exports.answer(), 42)

    const pipelineOutput = join(directory, "pipeline-output.wasm")
    const pipelineEnvironment = { ...process.env, MATRA_BOOTSTRAP_CACHE_DIR: join(directory, "bootstrap-cache") }
    const pipelineResult = spawnSync("node", ["crates/matra-seed/host/bootstrap.mjs", hostInput, pipelineOutput], { cwd: root, encoding: "utf8", env: pipelineEnvironment })
    assert.equal(pipelineResult.status, 0, pipelineResult.stderr)
    assert.equal(pipelineResult.stdout, "Built bootstrap compiler cache.\n")
    const cacheEntries = await readdir(pipelineEnvironment.MATRA_BOOTSTRAP_CACHE_DIR)
    assert.equal(cacheEntries.length, 1)
    assert.match(cacheEntries[0], /^[0-9a-f]{64}\.wasm$/)
    const pipelineModule = await WebAssembly.instantiate(await readFile(pipelineOutput))
    assert.equal(pipelineModule.instance.exports.answer(), 42)

    await writeFile(hostInput, "module demo\nfn answer() -> i32 { return value }")
    const hostDiagnostic = spawnSync("node", ["crates/matra-seed/host/compile.mjs", output, hostInput, hostOutput], { cwd: root, encoding: "utf8" })
    assert.equal(hostDiagnostic.status, 1)
    const expectedHostDiagnostic = [
      `${hostInput}:2:29: parse error: expected value`,
      "fn answer() -> i32 { return value }",
      "                            ^^^^^",
      "",
    ].join("\n")
    assert.equal(hostDiagnostic.stderr, expectedHostDiagnostic)
    const pipelineDiagnostic = spawnSync("node", ["crates/matra-seed/host/bootstrap.mjs", hostInput, pipelineOutput], { cwd: root, encoding: "utf8", env: pipelineEnvironment })
    assert.equal(pipelineDiagnostic.status, 1)
    assert.equal(pipelineDiagnostic.stdout, "Using cached bootstrap compiler.\n")
    assert.equal((await readdir(pipelineEnvironment.MATRA_BOOTSTRAP_CACHE_DIR)).length, 1)
    assert.equal(pipelineDiagnostic.stderr, expectedHostDiagnostic)

    const recordPointer = module.instance.exports.compile(0, 0)
    const record = new DataView(module.instance.exports.memory.buffer, recordPointer, 36)
    assert.equal(record.getInt32(0, true), 0)
    const pointer = record.getInt32(4, true)
    const length = record.getInt32(8, true)
    assert.equal(record.getInt32(12, true), 0)
    assert.equal(record.getInt32(16, true), 0)
    assert.equal(record.getInt32(20, true), 0)
    assert.equal(record.getInt32(24, true), 0)
    assert.equal(record.getInt32(28, true), 0)
    assert.equal(record.getInt32(32, true), 0)
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
    const invalidProgramRecord = new DataView(module.instance.exports.memory.buffer, invalidProgramRecordPointer, 36)
    assert.equal(invalidProgramRecord.getInt32(0, true), 1)
    assert.equal(invalidProgramRecord.getInt32(20, true), 1)
    assert.equal(invalidProgramRecord.getInt32(24, true), 19)
    assert.equal(invalidProgramRecord.getInt32(28, true), 3)
    assert.equal(invalidProgramRecord.getInt32(32, true), 2)
    const invalidProgramDiagnosticPointer = invalidProgramRecord.getInt32(12, true)
    const invalidProgramDiagnosticLength = invalidProgramRecord.getInt32(16, true)
    const invalidProgramDiagnostic = new Uint8Array(module.instance.exports.memory.buffer, invalidProgramDiagnosticPointer, invalidProgramDiagnosticLength)
    assert.equal(new TextDecoder().decode(invalidProgramDiagnostic), "parse error at 19")
    assert.equal(formatCompilerDiagnostic(new TextEncoder().encode("module demo import 123"), module.instance.exports.memory, invalidProgramRecordPointer), [
      "parse error: expected identifier at 1:20",
      "module demo import 123",
      "                   ^^^",
    ].join("\n"))

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

    const exportedFunctionSource = new TextEncoder().encode("module demo\nexport fn exported() -> i32 { return 7 }")
    const exportedFunctionPointer = module.instance.exports.alloc(exportedFunctionSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, exportedFunctionPointer, exportedFunctionSource.length).set(exportedFunctionSource)
    const exportedFunctionRecordPointer = module.instance.exports.compile(exportedFunctionPointer, exportedFunctionSource.length)
    const exportedFunctionRecord = new DataView(module.instance.exports.memory.buffer, exportedFunctionRecordPointer, 20)
    assert.equal(exportedFunctionRecord.getInt32(0, true), 0)
    const exportedFunctionOutputPointer = exportedFunctionRecord.getInt32(4, true)
    const exportedFunctionOutputLength = exportedFunctionRecord.getInt32(8, true)
    const exportedFunctionOutput = new Uint8Array(module.instance.exports.memory.buffer, exportedFunctionOutputPointer, exportedFunctionOutputLength)
    const compiledExportedFunction = await WebAssembly.instantiate(exportedFunctionOutput)
    assert.equal(compiledExportedFunction.instance.exports.exported(), 7)

    const negativeFunctionSource = new TextEncoder().encode("module demo\nfn negative() -> i32 { return -123456 }")
    const negativeFunctionPointer = module.instance.exports.alloc(negativeFunctionSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, negativeFunctionPointer, negativeFunctionSource.length).set(negativeFunctionSource)
    const negativeFunctionRecordPointer = module.instance.exports.compile(negativeFunctionPointer, negativeFunctionSource.length)
    const negativeFunctionRecord = new DataView(module.instance.exports.memory.buffer, negativeFunctionRecordPointer, 20)
    assert.equal(negativeFunctionRecord.getInt32(0, true), 0)
    const negativeFunctionOutputPointer = negativeFunctionRecord.getInt32(4, true)
    const negativeFunctionOutputLength = negativeFunctionRecord.getInt32(8, true)
    const negativeFunctionOutput = new Uint8Array(module.instance.exports.memory.buffer, negativeFunctionOutputPointer, negativeFunctionOutputLength)
    const compiledNegativeFunction = await WebAssembly.instantiate(negativeFunctionOutput)
    assert.equal(compiledNegativeFunction.instance.exports.negative(), -123456)

    const sentinelLiteralSource = new TextEncoder().encode("module demo\nfn negative_one() -> i32 { return -1 }\nfn negative_two() -> i32 { return -2 }")
    const sentinelLiteralPointer = module.instance.exports.alloc(sentinelLiteralSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, sentinelLiteralPointer, sentinelLiteralSource.length).set(sentinelLiteralSource)
    assert.equal(module.instance.exports.function_parameter_count(sentinelLiteralPointer, sentinelLiteralSource.length, 0), 0)
    assert.equal(module.instance.exports.function_body_kind(sentinelLiteralPointer, sentinelLiteralSource.length, 0), 0)
    assert.equal(module.instance.exports.function_body_value(sentinelLiteralPointer, sentinelLiteralSource.length, 0), -1)
    assert.equal(module.instance.exports.function_body_kind(sentinelLiteralPointer, sentinelLiteralSource.length, 1), 0)
    assert.equal(module.instance.exports.function_body_value(sentinelLiteralPointer, sentinelLiteralSource.length, 1), -2)
    const sentinelLiteralRecordPointer = module.instance.exports.compile(sentinelLiteralPointer, sentinelLiteralSource.length)
    const sentinelLiteralRecord = new DataView(module.instance.exports.memory.buffer, sentinelLiteralRecordPointer, 20)
    assert.equal(sentinelLiteralRecord.getInt32(0, true), 0)
    const sentinelLiteralOutputPointer = sentinelLiteralRecord.getInt32(4, true)
    const sentinelLiteralOutputLength = sentinelLiteralRecord.getInt32(8, true)
    const sentinelLiteralOutput = new Uint8Array(module.instance.exports.memory.buffer, sentinelLiteralOutputPointer, sentinelLiteralOutputLength)
    const compiledSentinelLiteral = await WebAssembly.instantiate(sentinelLiteralOutput)
    assert.equal(compiledSentinelLiteral.instance.exports.negative_two(), -2)

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
    assert.equal(module.instance.exports.function_parameter_count(parameterFunctionPointer, parameterFunctionSource.length, 0), 1)
    assert.equal(module.instance.exports.function_body_kind(parameterFunctionPointer, parameterFunctionSource.length, 0), 1)

    const parameterCallSource = new TextEncoder().encode("module demo\nfn identity(value: i32) -> i32 { return value }\nfn answer() -> i32 { return identity(-42) }")
    const parameterCallPointer = module.instance.exports.alloc(parameterCallSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, parameterCallPointer, parameterCallSource.length).set(parameterCallSource)
    const parameterCallRecordPointer = module.instance.exports.compile(parameterCallPointer, parameterCallSource.length)
    const parameterCallRecord = new DataView(module.instance.exports.memory.buffer, parameterCallRecordPointer, 20)
    assert.equal(parameterCallRecord.getInt32(0, true), 0)
    const parameterCallOutputPointer = parameterCallRecord.getInt32(4, true)
    const parameterCallOutputLength = parameterCallRecord.getInt32(8, true)
    const parameterCallOutput = new Uint8Array(module.instance.exports.memory.buffer, parameterCallOutputPointer, parameterCallOutputLength)
    const compiledParameterCall = await WebAssembly.instantiate(parameterCallOutput)
    assert.equal(compiledParameterCall.instance.exports.answer(), -42)

    const forwardedParameterSource = new TextEncoder().encode("module demo\nfn identity(value: i32) -> i32 { return value }\nfn forward(value: i32) -> i32 { return identity(value) }")
    const forwardedParameterPointer = module.instance.exports.alloc(forwardedParameterSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, forwardedParameterPointer, forwardedParameterSource.length).set(forwardedParameterSource)
    const forwardedParameterRecordPointer = module.instance.exports.compile(forwardedParameterPointer, forwardedParameterSource.length)
    const forwardedParameterRecord = new DataView(module.instance.exports.memory.buffer, forwardedParameterRecordPointer, 20)
    assert.equal(forwardedParameterRecord.getInt32(0, true), 0)
    const forwardedParameterOutputPointer = forwardedParameterRecord.getInt32(4, true)
    const forwardedParameterOutputLength = forwardedParameterRecord.getInt32(8, true)
    const forwardedParameterOutput = new Uint8Array(module.instance.exports.memory.buffer, forwardedParameterOutputPointer, forwardedParameterOutputLength)
    const compiledForwardedParameter = await WebAssembly.instantiate(forwardedParameterOutput)
    assert.equal(compiledForwardedParameter.instance.exports.forward(42), 42)

    const missingArgumentSourceText = "module demo\nfn identity(value: i32) -> i32 { return value }\nfn answer() -> i32 { return identity() }"
    const missingArgumentSource = new TextEncoder().encode(missingArgumentSourceText)
    const missingArgumentPointer = module.instance.exports.alloc(missingArgumentSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, missingArgumentPointer, missingArgumentSource.length).set(missingArgumentSource)
    const missingArgumentRecordPointer = module.instance.exports.compile(missingArgumentPointer, missingArgumentSource.length)
    const missingArgumentRecord = new DataView(module.instance.exports.memory.buffer, missingArgumentRecordPointer, 36)
    assert.equal(missingArgumentRecord.getInt32(0, true), 1)
    assert.equal(missingArgumentRecord.getInt32(20, true), 3)
    assert.equal(missingArgumentRecord.getInt32(24, true), missingArgumentSourceText.lastIndexOf("identity(") + 9)
    assert.equal(missingArgumentRecord.getInt32(28, true), 1)
    assert.equal(missingArgumentRecord.getInt32(32, true), 0)
    const missingArgumentDiagnosticPointer = missingArgumentRecord.getInt32(12, true)
    const missingArgumentDiagnosticLength = missingArgumentRecord.getInt32(16, true)
    const missingArgumentDiagnostic = new Uint8Array(module.instance.exports.memory.buffer, missingArgumentDiagnosticPointer, missingArgumentDiagnosticLength)
    assert.equal(new TextDecoder().decode(missingArgumentDiagnostic), `argument count mismatch at ${missingArgumentSourceText.lastIndexOf("identity(") + 9}`)

    const extraArgumentSource = new TextEncoder().encode("module demo\nfn helper() -> i32 { return 42 }\nfn answer() -> i32 { return helper(1) }")
    const extraArgumentPointer = module.instance.exports.alloc(extraArgumentSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, extraArgumentPointer, extraArgumentSource.length).set(extraArgumentSource)
    const extraArgumentRecordPointer = module.instance.exports.compile(extraArgumentPointer, extraArgumentSource.length)
    const extraArgumentRecord = new DataView(module.instance.exports.memory.buffer, extraArgumentRecordPointer, 20)
    assert.equal(extraArgumentRecord.getInt32(0, true), 1)

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

    const indexedCallSource = new TextEncoder().encode("module demo\nfn unused() -> i32 { return 1 }\nfn helper() -> i32 { return 42 }\nfn answer() -> i32 { return helper() }")
    const indexedCallPointer = module.instance.exports.alloc(indexedCallSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, indexedCallPointer, indexedCallSource.length).set(indexedCallSource)
    const indexedCallRecordPointer = module.instance.exports.compile(indexedCallPointer, indexedCallSource.length)
    const indexedCallRecord = new DataView(module.instance.exports.memory.buffer, indexedCallRecordPointer, 20)
    assert.equal(indexedCallRecord.getInt32(0, true), 0)
    const indexedCallOutputPointer = indexedCallRecord.getInt32(4, true)
    const indexedCallOutputLength = indexedCallRecord.getInt32(8, true)
    const indexedCallOutput = new Uint8Array(module.instance.exports.memory.buffer, indexedCallOutputPointer, indexedCallOutputLength)
    const compiledIndexedCall = await WebAssembly.instantiate(indexedCallOutput)
    assert.equal(compiledIndexedCall.instance.exports.answer(), 42)
    assert.equal(module.instance.exports.function_body_kind(indexedCallPointer, indexedCallSource.length, 2), 2)
    assert.equal(module.instance.exports.function_body_value(indexedCallPointer, indexedCallSource.length, 2), 1)

    const literalFunctionsSource = new TextEncoder().encode("module demo\nfn first() -> i32 { return 1 }\nfn second() -> i32 { return 2 }")
    const literalFunctionsPointer = module.instance.exports.alloc(literalFunctionsSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, literalFunctionsPointer, literalFunctionsSource.length).set(literalFunctionsSource)
    const literalFunctionsRecordPointer = module.instance.exports.compile(literalFunctionsPointer, literalFunctionsSource.length)
    const literalFunctionsRecord = new DataView(module.instance.exports.memory.buffer, literalFunctionsRecordPointer, 20)
    assert.equal(literalFunctionsRecord.getInt32(0, true), 0)
    const literalFunctionsOutputPointer = literalFunctionsRecord.getInt32(4, true)
    const literalFunctionsOutputLength = literalFunctionsRecord.getInt32(8, true)
    const literalFunctionsOutput = new Uint8Array(module.instance.exports.memory.buffer, literalFunctionsOutputPointer, literalFunctionsOutputLength)
    const compiledLiteralFunctions = await WebAssembly.instantiate(literalFunctionsOutput)
    assert.equal(compiledLiteralFunctions.instance.exports.second(), 2)

    const longFunctionName = "a".repeat(130)
    const longNameSource = new TextEncoder().encode(`module demo\nfn ${longFunctionName}() -> i32 { return 42 }`)
    const longNamePointer = module.instance.exports.alloc(longNameSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, longNamePointer, longNameSource.length).set(longNameSource)
    const longNameRecordPointer = module.instance.exports.compile(longNamePointer, longNameSource.length)
    const longNameRecord = new DataView(module.instance.exports.memory.buffer, longNameRecordPointer, 20)
    assert.equal(longNameRecord.getInt32(0, true), 0)
    const longNameOutputPointer = longNameRecord.getInt32(4, true)
    const longNameOutputLength = longNameRecord.getInt32(8, true)
    const longNameOutput = new Uint8Array(module.instance.exports.memory.buffer, longNameOutputPointer, longNameOutputLength)
    const compiledLongName = await WebAssembly.instantiate(longNameOutput)
    assert.equal(compiledLongName.instance.exports[longFunctionName](), 42)

    const largeSectionSourceText = [
      "module demo",
      ...Array.from({ length: 129 }, (_, index) => `fn value${index}() -> i32 { return ${index} }`),
      "fn answer() -> i32 { return value128() }",
    ].join("\n")
    const largeCompiler = await WebAssembly.instantiate(await readFile(output))
    largeCompiler.instance.exports.memory.grow(2)
    const largeSectionSource = new TextEncoder().encode(largeSectionSourceText)
    const largeSectionPointer = largeCompiler.instance.exports.alloc(largeSectionSource.length)
    new Uint8Array(largeCompiler.instance.exports.memory.buffer, largeSectionPointer, largeSectionSource.length).set(largeSectionSource)
    const largeSectionRecordPointer = largeCompiler.instance.exports.compile(largeSectionPointer, largeSectionSource.length)
    const largeSectionRecord = new DataView(largeCompiler.instance.exports.memory.buffer, largeSectionRecordPointer, 20)
    assert.equal(largeSectionRecord.getInt32(0, true), 0)
    const largeSectionOutputPointer = largeSectionRecord.getInt32(4, true)
    const largeSectionOutputLength = largeSectionRecord.getInt32(8, true)
    const largeSectionOutput = new Uint8Array(largeCompiler.instance.exports.memory.buffer, largeSectionOutputPointer, largeSectionOutputLength)
    const compiledLargeSection = await WebAssembly.instantiate(largeSectionOutput)
    assert.equal(compiledLargeSection.instance.exports.answer(), 128)

    const unknownCallSourceText = "module demo\nfn helper() -> i32 { return 1 }\nfn answer() -> i32 { return other() }"
    const unknownCallSource = new TextEncoder().encode(unknownCallSourceText)
    const unknownCallPointer = module.instance.exports.alloc(unknownCallSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, unknownCallPointer, unknownCallSource.length).set(unknownCallSource)
    const unknownCallRecordPointer = module.instance.exports.compile(unknownCallPointer, unknownCallSource.length)
    const unknownCallRecord = new DataView(module.instance.exports.memory.buffer, unknownCallRecordPointer, 32)
    assert.equal(unknownCallRecord.getInt32(0, true), 1)
    assert.equal(unknownCallRecord.getInt32(20, true), 2)
    assert.equal(unknownCallRecord.getInt32(24, true), unknownCallSourceText.indexOf("other"))
    assert.equal(unknownCallRecord.getInt32(28, true), "other".length)
    const unknownCallDiagnosticPointer = unknownCallRecord.getInt32(12, true)
    const unknownCallDiagnosticLength = unknownCallRecord.getInt32(16, true)
    const unknownCallDiagnostic = new Uint8Array(module.instance.exports.memory.buffer, unknownCallDiagnosticPointer, unknownCallDiagnosticLength)
    assert.equal(new TextDecoder().decode(unknownCallDiagnostic), `unknown function at ${unknownCallSourceText.indexOf("other")}`)
    assert.equal(formatCompilerDiagnostic(unknownCallSource, module.instance.exports.memory, unknownCallRecordPointer), [
      "unknown function at 3:29",
      "fn answer() -> i32 { return other() }",
      "                            ^^^^^",
    ].join("\n"))

    const tableSourceText = "module demo\nfn one() -> i32 { return 1 }\nfn two() -> i32 { return 2 }\nfn three() -> i32 { return 3 }"
    const tableSource = new TextEncoder().encode(tableSourceText)
    const tablePointer = module.instance.exports.alloc(tableSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, tablePointer, tableSource.length).set(tableSource)
    assert.equal(module.instance.exports.function_count(tablePointer, tableSource.length), 3)
    assert.equal(module.instance.exports.function_index(tablePointer, tableSource.length, tableSourceText.indexOf("one")), 0)
    assert.equal(module.instance.exports.function_index(tablePointer, tableSource.length, tableSourceText.indexOf("two")), 1)
    assert.equal(module.instance.exports.function_index(tablePointer, tableSource.length, tableSourceText.indexOf("three")), 2)

    const invalidFunctionSourceText = "module demo\nfn answer() -> i32 { return value }"
    const invalidFunctionSource = new TextEncoder().encode(invalidFunctionSourceText)
    const invalidFunctionPointer = module.instance.exports.alloc(invalidFunctionSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, invalidFunctionPointer, invalidFunctionSource.length).set(invalidFunctionSource)
    const invalidFunctionRecordPointer = module.instance.exports.compile(invalidFunctionPointer, invalidFunctionSource.length)
    const invalidFunctionRecord = new DataView(module.instance.exports.memory.buffer, invalidFunctionRecordPointer, 36)
    assert.equal(invalidFunctionRecord.getInt32(0, true), 1)
    assert.equal(invalidFunctionRecord.getInt32(24, true), invalidFunctionSourceText.indexOf("value"))
    assert.equal(invalidFunctionRecord.getInt32(28, true), "value".length)
    assert.equal(invalidFunctionRecord.getInt32(32, true), 12)
    assert.deepEqual(sourcePosition(invalidFunctionSource, invalidFunctionRecord.getInt32(24, true)), { line: 2, column: 29 })
    assert.equal(formatCompilerDiagnostic(invalidFunctionSource, module.instance.exports.memory, invalidFunctionRecordPointer), [
      "parse error: expected value at 2:29",
      "fn answer() -> i32 { return value }",
      "                            ^^^^^",
    ].join("\n"))
    const invalidFunctionDiagnosticPointer = invalidFunctionRecord.getInt32(12, true)
    const invalidFunctionDiagnosticLength = invalidFunctionRecord.getInt32(16, true)
    const invalidFunctionDiagnostic = new Uint8Array(module.instance.exports.memory.buffer, invalidFunctionDiagnosticPointer, invalidFunctionDiagnosticLength)
    assert.equal(new TextDecoder().decode(invalidFunctionDiagnostic), `parse error at ${invalidFunctionSourceText.indexOf("value")}`)

    const incompleteFunctionSourceText = "module demo\nfn answer("
    const incompleteFunctionSource = new TextEncoder().encode(incompleteFunctionSourceText)
    const incompleteFunctionPointer = module.instance.exports.alloc(incompleteFunctionSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, incompleteFunctionPointer, incompleteFunctionSource.length).set(incompleteFunctionSource)
    const incompleteFunctionRecordPointer = module.instance.exports.compile(incompleteFunctionPointer, incompleteFunctionSource.length)
    const incompleteFunctionRecord = new DataView(module.instance.exports.memory.buffer, incompleteFunctionRecordPointer, 36)
    assert.equal(incompleteFunctionRecord.getInt32(0, true), 1)
    assert.equal(incompleteFunctionRecord.getInt32(28, true), 0)
    assert.equal(incompleteFunctionRecord.getInt32(32, true), 5)
    const incompleteFunctionDiagnosticPointer = incompleteFunctionRecord.getInt32(12, true)
    const incompleteFunctionDiagnosticLength = incompleteFunctionRecord.getInt32(16, true)
    const incompleteFunctionDiagnostic = new Uint8Array(module.instance.exports.memory.buffer, incompleteFunctionDiagnosticPointer, incompleteFunctionDiagnosticLength)
    assert.equal(new TextDecoder().decode(incompleteFunctionDiagnostic), `parse error at ${incompleteFunctionSourceText.length}`)
    assert.equal(formatCompilerDiagnostic(incompleteFunctionSource, module.instance.exports.memory, incompleteFunctionRecordPointer), [
      "parse error: expected parameter or ) at 2:11",
      "fn answer(",
      "          ^",
    ].join("\n"))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
