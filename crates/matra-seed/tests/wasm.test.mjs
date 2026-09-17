import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { cachedCompiler } from "../host/bootstrap-compiler.mjs"
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

test("bootstrap compiler accepts a call comparison in a conditional condition", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-conditional-"))
  const input = join(directory, "conditional.md")
  const output = join(directory, "conditional.wasm")
  await writeFile(input, [
    "# Conditional call comparison",
    "",
    "```compiler.matra.program",
    "module demo",
    "",
    "fn is_arithmetic_operator(source: bytes, value: i32) -> i32 {",
    "  if value == 43 {",
    "    return 1",
    "  }",
    "  return 0",
    "}",
    "",
    "export fn answer(source: bytes, call_separator: i32) -> i32 {",
    "  while is_arithmetic_operator(source, call_separator) == 1 {",
    "    return 42",
    "  }",
    "  return 0",
    "}",
    "```",
    "",
  ].join("\n"))

  try {
    const result = spawnSync(
      "cargo",
      ["run", "--quiet", "--manifest-path", "crates/matra-seed/Cargo.toml", "--", input, output, "--entry", "compiler.matra.program"],
      { cwd: root, encoding: "utf8" },
    )
    assert.equal(result.status, 0, result.stderr)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("bootstrap compiler accepts a simple conditional return in a function body", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-simple-conditional-"))
  const input = join(directory, "simple-conditional.md")
  const output = join(directory, "simple-conditional.wasm")
  await writeFile(input, [
    "# Simple conditional return",
    "",
    "```compiler.matra.program",
    "module demo",
    "",
    "export fn answer(value: i32) -> i32 {",
    "  if value == 9 {",
    "    return 1",
    "  }",
    "  return 0",
    "}",
    "```",
    "",
  ].join("\n"))

  try {
    const result = spawnSync(
      "cargo",
      ["run", "--quiet", "--manifest-path", "crates/matra-seed/Cargo.toml", "--", input, output, "--entry", "compiler.matra.program"],
      { cwd: root, encoding: "utf8" },
    )
    assert.equal(result.status, 0, result.stderr)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("Rust seed executes parenthesized let and set statements", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-let-set-"))
  const input = join(directory, "let-set.md")
  const output = join(directory, "let-set.wasm")
  await writeFile(input, [
    "# Parenthesized let and set",
    "",
    "```answer.matra.program",
    "module example",
    "",
    "export fn answer() -> i32 {",
    "  let (value: i32 = 40)",
    "  set (value = value + 2)",
    "  return value",
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

    const { instance } = await WebAssembly.instantiate(await readFile(output))
    assert.equal(instance.exports.answer(), 42)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("bootstrap compiler executes top-level parenthesized let and set statements", async () => {
  const compilerBytes = await readFile(await cachedCompiler())
  const source = new TextEncoder().encode(`module example
export fn answer() -> i32 {
  let (value = 40)
  set (value = value + 2)
  return value
}`)
  const { instance: { exports: { alloc, compile, memory } } } = await WebAssembly.instantiate(compilerBytes)
  const pointer = alloc(source.length)
  new Uint8Array(memory.buffer, pointer, source.length).set(source)
  const recordPointer = compile(pointer, source.length)
  const record = new DataView(memory.buffer, recordPointer, 36)
  assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
  const output = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
  const { instance: { exports: generated } } = await WebAssembly.instantiate(output)
  assert.equal(generated.answer(), 42)
})

test("bootstrap compiler accepts a call guard before a local and while", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-call-guard-"))
  const input = join(directory, "call-guard.md")
  const output = join(directory, "call-guard.wasm")
  await writeFile(input, [
    "# Call guard before local and while",
    "",
    "```compiler.matra.program",
    "module demo",
    "",
    "fn is_zero(source: bytes, value: i32) -> i32 {",
    "  if value == 0 {",
    "    return 1",
    "  }",
    "  return 0",
    "}",
    "",
    "export fn answer(source: bytes, value: i32) -> i32 {",
    "  if is_zero(source, value) == 0 {",
    "    return 1",
    "  }",
    "  let current = value",
    "  while current != 0 {",
    "    current = 0",
    "  }",
    "  return current",
    "}",
    "```",
    "",
  ].join("\n"))

  try {
    const result = spawnSync(
      "cargo",
      ["run", "--quiet", "--manifest-path", "crates/matra-seed/Cargo.toml", "--", input, output, "--entry", "compiler.matra.program"],
      { cwd: root, encoding: "utf8" },
    )
    assert.equal(result.status, 0, result.stderr)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("bootstrap compiler accepts multiple statements inside a loop-nested conditional", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-loop-conditional-"))
  const input = join(directory, "loop-conditional.md")
  const output = join(directory, "loop-conditional.wasm")
  await writeFile(input, [
    "# Multi-statement loop-nested conditional",
    "",
    "```compiler.matra.program",
    "module demo",
    "",
    "export fn answer(source: bytes, offset: i32) -> i32 {",
    "  let call_argument = offset",
    "  while call_argument != 0 {",
    "    if call_argument == 1 {",
    "      let call_field = 2",
    "      call_argument = call_field",
    "    }",
    "  }",
    "  return call_argument",
    "}",
    "```",
    "",
  ].join("\n"))

  try {
    const result = spawnSync(
      "cargo",
      ["run", "--quiet", "--manifest-path", "crates/matra-seed/Cargo.toml", "--", input, output, "--entry", "compiler.matra.program"],
      { cwd: root, encoding: "utf8" },
    )
    assert.equal(result.status, 0, result.stderr)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("bootstrap compiler accepts a nested while as a sibling statement inside another while", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-nested-while-"))
  const input = join(directory, "nested-while.md")
  const output = join(directory, "nested-while.wasm")
  await writeFile(input, [
    "# Nested while as a sibling statement",
    "",
    "```compiler.matra.program",
    "module demo",
    "",
    "fn is_symbol(source: bytes, value: i32, target: i32) -> i32 {",
    "  return 0",
    "}",
    "",
    "export fn answer(source: bytes, call_argument: i32) -> i32 {",
    "  let call_separator = call_argument",
    "  while is_symbol(source, call_argument, 41) == 0 {",
    "    if is_symbol(source, call_separator, 46) == 1 {",
    "      let call_field = call_separator",
    "      call_separator = call_field",
    "    }",
    "    while is_symbol(source, call_separator, 43) == 1 {",
    "      call_separator = call_argument",
    "    }",
    "    call_argument = call_separator",
    "  }",
    "  return call_separator",
    "}",
    "```",
    "",
  ].join("\n"))

  try {
    const result = spawnSync(
      "cargo",
      ["run", "--quiet", "--manifest-path", "crates/matra-seed/Cargo.toml", "--", input, output, "--entry", "compiler.matra.program"],
      { cwd: root, encoding: "utf8" },
    )
    assert.equal(result.status, 0, result.stderr)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("bootstrap compiler accepts a loop local conditional with a struct field RHS", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-loop-local-field-"))
  const input = join(directory, "loop-local-field.md")
  const output = join(directory, "loop-local-field.wasm")
  await writeFile(input, [
    "# Loop local conditional with a struct field RHS",
    "",
    "```compiler.matra.program",
    "module demo",
    "",
    "struct pair { left: i32 right: i32 }",
    "",
    "export fn answer(value: i32, record: pair) -> i32 {",
    "  while value != 0 {",
    "    if value < record.right {",
    "      value = 0",
    "    }",
    "  }",
    "  return value",
    "}",
    "```",
    "",
  ].join("\n"))

  try {
    const result = spawnSync(
      "cargo",
      ["run", "--quiet", "--manifest-path", "crates/matra-seed/Cargo.toml", "--", input, output, "--entry", "compiler.matra.program"],
      { cwd: root, encoding: "utf8" },
    )
    assert.equal(result.status, 0, result.stderr)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("bootstrap compiler executes call assignments in both loop conditional branches", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-conditional-assignment-"))
  const input = join(directory, "input.matra")
  const output = join(directory, "output.wasm")
  try {
    for (const condition of ["value == 1", "identity(value) == 1"]) {
      for (const earlyReturn of [false, true]) {
        await writeFile(input, `module demo
struct pair { left: i32 right: i32 }
fn make_pair() -> pair { return pair(20, 20) }
fn identity(value: i32) -> i32 { return value }
fn add(left: i32, right: i32) -> i32 { let sum = left + right return sum }
export fn answer(value: i32, record: pair) -> i32 {
  let result = 0
  while result == 0 {
    if ${condition} {
      ${earlyReturn ? "return 42" : "result = add(record.left + 1, 1 + record.right)"}
    } else {
      result = add(record.left + 2, 2 + record.right)
    }
  }
  return result
}
`)
        const result = spawnSync("node", ["crates/matra-seed/host/bootstrap.mjs", input, output], {
          cwd: root, encoding: "utf8", timeout: 30000,
        })
        assert.equal(result.status, 0, result.stderr)
        const { instance } = await WebAssembly.instantiate(await readFile(output))
        new Int32Array(instance.exports.memory.buffer, 1024, 2).set([20, 20])
        assert.equal(instance.exports.answer(1, 1024), 42)
        assert.equal(instance.exports.answer(2, 1024), 44)
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("bootstrap compiler executes repeated local, while and conditional statements", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-statement-sequence-"))
  const input = join(directory, "input.matra")
  const output = join(directory, "output.wasm")
  try {
    const statements = Array.from({ length: 12 }, (_, index) => `
  let value${index} = identity(${index})
  while value${index} < ${index + 1} {
    value${index} = value${index} + 1
  }
  result = identity(result)
  result = -result
  result = -result
  result = result + 1
  if identity(value${index}) == ${index + 1} {
    let nested${index} = 1
    if flag == 1 {
      result = result + nested${index}
    } else {
      result = result + 2
    }
  }
  result = result + 2
`).join("")
    await writeFile(input, `module demo
fn identity(value: i32) -> i32 { return value }
export fn answer(flag: i32) -> i32 {
  flag = flag + 0
  let result = 0
${statements}
  let final_value = result + 10
  return final_value
}
`)
    const compiler = await WebAssembly.instantiate(await readFile(await cachedCompiler()))
    const { alloc, compile, memory } = compiler.instance.exports
    memory.grow(64)
    const source = await readFile(input)
    const pointer = alloc(source.length)
    new Uint8Array(memory.buffer, pointer, source.length).set(source)
    const recordPointer = compile(pointer, source.length)
    const record = new DataView(memory.buffer, recordPointer, 36)
    assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
    const bytes = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
    const { instance } = await WebAssembly.instantiate(bytes)
    assert.equal(instance.exports.answer(1), 58)
    assert.equal(instance.exports.answer(0), 70)

    for (const ending of ["}", "", "123 return value }", "let other = 2 }"]) {
      await writeFile(input, `module demo\nfn answer() -> i32 { let value = 1 ${ending}`)
      const invalid = spawnSync("node", ["crates/matra-seed/host/bootstrap.mjs", input, output], {
        cwd: root, encoding: "utf8", timeout: 30000,
      })
      assert.equal(invalid.status, 1, invalid.stderr)
      assert.match(invalid.stderr, /parse error: expected return/)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("bootstrap compiler emits declarations and arithmetic returns inside a conditional", async () => {
  const { instance: { exports: { alloc, compile, memory } } } =
    await WebAssembly.instantiate(await readFile(await cachedCompiler()))
  const source = new TextEncoder().encode(`module demo
fn identity(value: i32) -> i32 { return value }
export fn answer(flag: i32) -> i32 {
  let first = identity(2) + 3
  if flag >= 1 {
    let second = identity(first) + 2
    let third = second + 1
    return third + first
  }
  return first
}`)
  memory.grow(8)
  const pointer = alloc(source.length)
  new Uint8Array(memory.buffer, pointer, source.length).set(source)
  const recordPointer = compile(pointer, source.length)
  const record = new DataView(memory.buffer, recordPointer, 36)
  assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
  const output = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
  const { instance } = await WebAssembly.instantiate(output)
  assert.equal(instance.exports.answer(1), 13)
  assert.equal(instance.exports.answer(0), 5)
})

test("bootstrap compiler lowers byte intrinsics in nested assignment expressions", async () => {
  const { instance: { exports: { alloc, compile, memory } } } =
    await WebAssembly.instantiate(await readFile(await cachedCompiler()))
  const source = new TextEncoder().encode(`module demo
fn identity(value: i32) -> i32 { return value }
export fn answer(prefix: bytes, source: bytes, offset: i32) -> i32 {
  let size = byte_length(source)
  let value = identity(byte_at(source, offset + 1)) + byte_length(prefix)
  value = value + identity(byte_at(source, offset))
  let negative = -identity(size)
  return value + negative
}`)
  memory.grow(8)
  const pointer = alloc(source.length)
  new Uint8Array(memory.buffer, pointer, source.length).set(source)
  const recordPointer = compile(pointer, source.length)
  const record = new DataView(memory.buffer, recordPointer, 36)
  assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
  const output = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
  const { instance } = await WebAssembly.instantiate(output)
  new Uint8Array(instance.exports.memory.buffer, 100, 3).set([128, 255, 7])
  assert.equal(instance.exports.answer(0, 9, 100, 3, 0), 389)
  assert.equal(instance.exports.answer(0, 4, 100, 3, 1), 263)
})

test("bootstrap compiler executes the bootstrap lexer with nested loop returns", async () => {
  const markdown = await readFile(new URL("../examples/compiler.md", import.meta.url), "utf8")
  const program = markdown.split("```compiler.matra.program\n")[1]
  const lexer = program.slice(0, program.indexOf("// A temporary execution probe")).replace("fn next_token(", "export fn next_token(")
  const { instance: { exports: { alloc, compile, memory } } } =
    await WebAssembly.instantiate(await readFile(await cachedCompiler()))
  memory.grow(32)
  const source = new TextEncoder().encode(lexer)
  const pointer = alloc(source.length)
  new Uint8Array(memory.buffer, pointer, source.length).set(source)
  const recordPointer = compile(pointer, source.length)
  const record = new DataView(memory.buffer, recordPointer, 36)
  assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
  const output = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
  const { instance: { exports: generated } } = await WebAssembly.instantiate(output)
  for (const [input, offset, expected] of [
    ["abc123_", 0, [1, 0, 7]],
    ["  // comment\nfoo9", 0, [1, 13, 4]],
    ["123!", 0, [2, 0, 3]],
    ["/", 0, [3, 0, 1]],
    ["/x", 0, [3, 0, 1]],
    ["", 0, [0, 0, 0]],
    [" // end", 0, [0, 7, 0]],
    ["skip next2", 5, [1, 5, 5]],
  ]) {
    const bytes = new TextEncoder().encode(input)
    new Uint8Array(generated.memory.buffer, 1024, bytes.length).set(bytes)
    const result = generated.next_token(1024, bytes.length, offset)
    const fields = new DataView(generated.memory.buffer, result, 12)
    assert.deepEqual([0, 4, 8].map((index) => fields.getInt32(index, true)), expected, input)
  }
})

test("conditional statement length matches emitted comparison and nested block bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-conditional-bytes-"))
  try {
    const markdown = await readFile(new URL("../examples/compiler.md", import.meta.url), "utf8")
    const program = markdown.split("```compiler.matra.program\n")[1].split("\n```")[0]
    const input = join(directory, "probe.md")
    const output = join(directory, "probe.wasm")
    await writeFile(input, "```compiler.matra.program\n" + program + `
export fn conditional_probe(buffer: bytes, source: bytes, offset: i32) -> i32 {
  let table = function_table(source)
  let function = function_at_index(source, 1)
  let statement = next_token(source, offset)
  let length = conditional_statement_length(source, table, function, statement)
  let end = write_conditional_statement(buffer, 8, source, table, function, statement)
  return length * 65536 + end
}
` + "\n```\n")
    const built = spawnSync("cargo", ["run", "--quiet", "--manifest-path", "crates/matra-seed/Cargo.toml", "--", input, output, "--entry", "compiler.matra.program"], { cwd: root, encoding: "utf8" })
    assert.equal(built.status, 0, built.stderr)
    const { instance: { exports: generated } } = await WebAssembly.instantiate(await readFile(output))
    generated.memory.grow(32)
    for (const [statement, expected] of [
      ["if left < right { left = 3 }", [0x20, 0, 0x20, 1, 0x48, 4, 0x40, 0x41, 3, 0x21, 0, 0x0b]],
      ["if left == 128 { left = 3 }", [0x20, 0, 0x41, 0x80, 1, 0x46, 4, 0x40, 0x41, 3, 0x21, 0, 0x0b]],
      ["if identity(left) == right { left = 3 }", [0x20, 0, 0x10, 0, 0x20, 1, 0x46, 4, 0x40, 0x41, 3, 0x21, 0, 0x0b]],
      ["if left == identity(right) { left = 3 }", [0x20, 0, 0x20, 1, 0x10, 0, 0x46, 4, 0x40, 0x41, 3, 0x21, 0, 0x0b]],
      ["if left < right { if right > 128 { left = 3 } left = right }", [0x20, 0, 0x20, 1, 0x48, 4, 0x40, 0x20, 1, 0x41, 0x80, 1, 0x4a, 4, 0x40, 0x41, 3, 0x21, 0, 0x0b, 0x20, 1, 0x21, 0, 0x0b]],
    ]) {
      const text = `module demo\nfn identity(value: i32) -> i32 { return value }\nfn answer(left: i32, right: i32) -> i32 { ${statement} return left }`
      const source = new TextEncoder().encode(text)
      const pointer = generated.alloc(source.length)
      new Uint8Array(generated.memory.buffer, pointer, source.length).set(source)
      const buffer = generated.alloc(256)
      new Uint8Array(generated.memory.buffer, buffer, 256).fill(0xaa)
      const measured = generated.conditional_probe(buffer, 256, pointer, source.length, text.indexOf("if "))
      assert.equal(measured >>> 16, expected.length, statement)
      assert.equal(measured & 0xffff, 8 + expected.length, statement)
      const bytes = new Uint8Array(generated.memory.buffer, buffer, 256)
      assert.deepEqual([...bytes.slice(8, 8 + expected.length)], expected, statement)
      assert.ok(bytes.slice(0, 8).every((byte) => byte === 0xaa), statement)
      assert.ok(bytes.slice(8 + expected.length).every((byte) => byte === 0xaa), statement)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("bootstrap compiler resolves chained struct aliases in nested conditionals", async () => {
  const compilerBytes = await readFile(await cachedCompiler())
  for (const initializer of ["parameter", "make(7, 41)"]) {
    const source = new TextEncoder().encode(`module demo
struct item { kind: i32 value: i32 }
fn make(kind: i32, value: i32) -> item { let current = kind return item(current, value) }
export fn answer(parameter: item, enabled: i32) -> i32 {
  let original = ${initializer}
  let alias = original
  if enabled == 1 {
    let nested = alias
    if nested.kind == 7 { let result = nested.value return result }
  }
  return 0
}`)
    const { instance: { exports: { alloc, compile, memory } } } = await WebAssembly.instantiate(compilerBytes)
    memory.grow(16)
    const pointer = alloc(source.length)
    new Uint8Array(memory.buffer, pointer, source.length).set(source)
    const recordPointer = compile(pointer, source.length)
    const record = new DataView(memory.buffer, recordPointer, 36)
    assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
    const output = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
    const { instance: { exports: generated } } = await WebAssembly.instantiate(output)
    const parameter = new DataView(generated.memory.buffer, 1024, 8)
    parameter.setInt32(0, 7, true)
    parameter.setInt32(4, 41, true)
    assert.equal(generated.answer(1024, 1), 41, initializer)
    assert.equal(generated.answer(1024, 0), 0, initializer)
  }
})

test("bootstrap compiler preserves array return body boundaries and both result slots", async () => {
  const compilerBytes = await readFile(await cachedCompiler())
  for (const type of ["[i32]", "bytes"]) {
    for (const prefix of ["", "fn identity(value: i32) -> i32 { return value }\n"]) {
      for (const body of ["return data", `let index = 1 ${type === "bytes" ? "byte_set" : "array_set"}(data, index, 42) return data`]) {
        const source = new TextEncoder().encode(`module demo\n${prefix}export fn answer(data: ${type}) -> ${type} { ${body} }`)
        const { instance: { exports: { alloc, compile, memory } } } = await WebAssembly.instantiate(compilerBytes)
        memory.grow(16)
        const pointer = alloc(source.length)
        new Uint8Array(memory.buffer, pointer, source.length).set(source)
        const recordPointer = compile(pointer, source.length)
        const record = new DataView(memory.buffer, recordPointer, 36)
        assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
        const output = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
        const { instance: { exports: generated } } = await WebAssembly.instantiate(output)
        assert.deepEqual(generated.answer(1024, 7), [1024, 7], `${type}: ${prefix}${body}`)
        if (body !== "return data") {
          const values = new DataView(generated.memory.buffer)
          assert.equal(type === "bytes" ? values.getUint8(1025) : values.getInt32(1028, true), 42)
        }
      }
    }
  }
})

test("bootstrap compiler executes signed LEB writes inside nested loop conditions", async () => {
  const markdown = await readFile(new URL("../examples/compiler.md", import.meta.url), "utf8")
  const writer = markdown.slice(markdown.indexOf("fn write_i32_leb("), markdown.indexOf("fn u32_leb_length(")).replace("fn write_i32_leb(", "export fn write_i32_leb(")
  const source = new TextEncoder().encode("module demo\nfn negate_i32(value: i32) -> i32 { let zero = 0 return zero - value }\n" + writer)
  const { instance: { exports: { alloc, compile, memory } } } = await WebAssembly.instantiate(await readFile(await cachedCompiler()))
  memory.grow(32)
  const pointer = alloc(source.length)
  new Uint8Array(memory.buffer, pointer, source.length).set(source)
  const recordPointer = compile(pointer, source.length)
  const record = new DataView(memory.buffer, recordPointer, 36)
  assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
  const output = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
  const { instance: { exports: generated } } = await WebAssembly.instantiate(output)
  for (const [value, expected] of [
    [0, [0]], [63, [63]], [64, [0xc0, 0]], [127, [0xff, 0]], [128, [0x80, 1]],
    [-1, [0x7f]], [-64, [0x40]], [-65, [0xbf, 0x7f]], [-128, [0x80, 0x7f]],
    [2147483647, [0xff, 0xff, 0xff, 0xff, 7]], [-2147483648, [0x80, 0x80, 0x80, 0x80, 0x78]],
  ]) {
    const bytes = new Uint8Array(generated.memory.buffer, 1024, 16)
    bytes.fill(0xaa)
    assert.deepEqual(generated.write_i32_leb(1024, 16, 3, value), [1024, 16])
    assert.deepEqual([...bytes.slice(3, 3 + expected.length)], expected, `${value}`)
    assert.ok(bytes.slice(0, 3).every((byte) => byte === 0xaa))
    assert.ok(bytes.slice(3 + expected.length).every((byte) => byte === 0xaa))
  }
})

test("bootstrap compiler lowers mutation call arguments and arbitrary bytes return locals", async () => {
  const source = new TextEncoder().encode(`module demo
fn unchanged(data: bytes) -> bytes { return data }
fn number(value: i32) -> i32 { return value }
export fn answer(data: bytes, table: [i32], flag: i32) -> i32 {
  let result = unchanged(data)
  let current = flag
  while current > 0 {
    if current == 1 {
      if number(current) == 1 {
        byte_set(result, number(current) + 1, number(127) + byte_at(data, 0))
        array_set(table, number(current) + 1, number(1000) + byte_at(result, 2))
      }
    } else {
      byte_set(result, number(3), number(200))
    }
    current = current - 1
  }
  return byte_length(result)
}`)
  const { instance: { exports: { alloc, compile, memory } } } = await WebAssembly.instantiate(await readFile(await cachedCompiler()))
  memory.grow(32)
  const pointer = alloc(source.length)
  new Uint8Array(memory.buffer, pointer, source.length).set(source)
  const recordPointer = compile(pointer, source.length)
  const record = new DataView(memory.buffer, recordPointer, 36)
  assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
  const output = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
  const { instance: { exports: generated } } = await WebAssembly.instantiate(output)
  const bytes = new Uint8Array(generated.memory.buffer, 1024, 4)
  bytes.set([1, 0, 0, 0])
  assert.equal(generated.answer(1024, 4, 2048, 5, 2), 4)
  assert.deepEqual([...bytes], [1, 0, 128, 200])
  assert.equal(new DataView(generated.memory.buffer).getInt32(2056, true), 1128)
})

test("bootstrap compiler preserves bytes, array and struct arguments in conditionals", async () => {
  const compilerBytes = await readFile(await cachedCompiler())
  for (const condition of [
    "matches(source, table, value, byte_length(source)) == 1",
    "identity(1) == matches(source, table, value, 3)",
    "matches(source, table, value, byte_length(source)) == identity(1)",
  ]) {
    const source = new TextEncoder().encode(`module demo
struct token { kind: i32 start: i32 length: i32 }
fn identity(value: i32) -> i32 { return value }
fn forward(table: [i32], value: i32) -> i32 { return value }
fn matches(source: bytes, table: [i32], value: token, expected: i32) -> i32 {
  let result = forward(table, expected)
  if byte_at(source, value.start) == result { return 1 }
  return 0
}
export fn answer(source: bytes, table: [i32], value: token) -> i32 {
  if ${condition} {
    let result = matches(source, table, value, byte_length(source))
    return result + 40
  } else {
    let result = matches(source, table, value, byte_length(source))
    return result + 20
  }
  return 0
}`)
    const { instance: { exports: { alloc, compile, memory } } } = await WebAssembly.instantiate(compilerBytes)
    memory.grow(16)
    const pointer = alloc(source.length)
    new Uint8Array(memory.buffer, pointer, source.length).set(source)
    const recordPointer = compile(pointer, source.length)
    const record = new DataView(memory.buffer, recordPointer, 36)
    assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
    const output = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
    const { instance: { exports: generated } } = await WebAssembly.instantiate(output)
    new Uint8Array(generated.memory.buffer, 1024, 3).set([9, 3, 7])
    const value = new DataView(generated.memory.buffer, 2048, 12)
    value.setInt32(4, 1, true)
    assert.equal(generated.answer(1024, 3, 4096, 17, 2048), 41, condition)
    value.setInt32(4, 0, true)
    assert.equal(generated.answer(1024, 3, 4096, 17, 2048), 20, condition)
  }
})

test("bootstrap compiler executes type_end with a conditional struct local", async () => {
  const markdown = await readFile(new URL("../examples/compiler.md", import.meta.url), "utf8")
  const program = markdown.split("```compiler.matra.program\n")[1]
  const source = new TextEncoder().encode(program.slice(0, program.indexOf("fn read_small_integer(")) + `
export fn probe(source: bytes) -> token {
  let first = next_token(source, 0)
  return type_end(source, first)
}
`)
  const { instance: { exports: { alloc, compile, memory } } } =
    await WebAssembly.instantiate(await readFile(await cachedCompiler()))
  memory.grow(32)
  const pointer = alloc(source.length)
  new Uint8Array(memory.buffer, pointer, source.length).set(source)
  const recordPointer = compile(pointer, source.length)
  const record = new DataView(memory.buffer, recordPointer, 36)
  assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
  const output = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
  const { instance: { exports: generated } } = await WebAssembly.instantiate(output)
  for (const [input, expected] of [["[i32]", [3, 4, 1]], ["i32", [1, 0, 3]]]) {
    const bytes = new TextEncoder().encode(input)
    new Uint8Array(generated.memory.buffer, 1024, bytes.length).set(bytes)
    const result = generated.probe(1024, bytes.length)
    const fields = new DataView(generated.memory.buffer, result, 12)
    assert.deepEqual([0, 4, 8].map((index) => fields.getInt32(index, true)), expected, input)
  }
})

test("bootstrap compiler lowers struct returns in both loop conditional branches", async () => {
  const compilerBytes = await readFile(await cachedCompiler())
  for (const condition of ["identity(value) == 1", "value == 1"]) {
    const { instance: { exports: { alloc, compile, memory } } } = await WebAssembly.instantiate(compilerBytes)
    memory.grow(16)
    const source = new TextEncoder().encode(`module demo
struct token { kind: i32 start: i32 length: i32 }
fn identity(value: i32) -> i32 { return value }
export fn answer(source: bytes, value: i32) -> token {
  let current = value
  while current > 0 {
    if ${condition} {
      return token(1, current + 1, identity(byte_at(source, 0)))
    } else {
      return token(2, current - 1, byte_at(source, 0) + 1)
    }
  }
  return token(0, 0, 0)
}`)
    const pointer = alloc(source.length)
    new Uint8Array(memory.buffer, pointer, source.length).set(source)
    const recordPointer = compile(pointer, source.length)
    const record = new DataView(memory.buffer, recordPointer, 36)
    assert.equal(record.getInt32(0, true), 0, formatCompilerDiagnostic(source, memory, recordPointer))
    const output = new Uint8Array(memory.buffer, record.getInt32(4, true), record.getInt32(8, true))
    const { instance: { exports: generated } } = await WebAssembly.instantiate(output)
    new Uint8Array(generated.memory.buffer)[1024] = 128
    for (const [value, expected] of [[1, [1, 2, 128]], [2, [2, 1, 129]], [0, [0, 0, 0]]]) {
      const result = generated.answer(1024, 1, value)
      const fields = new DataView(generated.memory.buffer, result, 12)
      assert.deepEqual([0, 4, 8].map((index) => fields.getInt32(index, true)), expected, condition)
    }
  }
})

test("seed reclaims temporary structs while preserving returned values and escaped allocations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "matra-seed-arena-"))
  try {
    const input = join(directory, "input.md")
    const output = join(directory, "output.wasm")
    await writeFile(input, `\`\`\`arena.matra.program
module arena
struct pair { left: i32 right: i32 }
export fn heap() -> i32 {
  let empty = allocate_bytes(0)
  return byte_pointer(empty)
}
fn make(value: i32) -> pair { return pair(value, value + 1) }
export fn scalar(value: i32) -> i32 {
  let temporary = make(value)
  if value > 0 { return temporary.right }
  return temporary.left
}
export fn recursive(depth: i32) -> pair {
  if depth == 0 { return pair(20, 22) }
  let previous = recursive(depth - 1)
  return pair(previous.left + 1, previous.right + 2)
}
export fn retain(value: pair) -> pair { return value }
fn allocate_result() -> i32 {
  let output = allocate_bytes(1)
  byte_set(output, 0, 99)
  return byte_pointer(output)
}
export fn escape() -> i32 {
  let temporary = make(7)
  return allocate_result()
}
export fn mutate(output: bytes) -> i32 {
  let temporary = make(41)
  byte_set(output, 0, temporary.right)
  return temporary.left
}
\`\`\`
`)
    const compiled = spawnSync("cargo", ["run", "--quiet", "--manifest-path", "crates/matra-seed/Cargo.toml", "--", input, output], {
      cwd: root, encoding: "utf8",
    })
    assert.equal(compiled.status, 0, compiled.stderr)
    const { instance: { exports: e } } = await WebAssembly.instantiate(await readFile(output))
    const initial = e.heap()
    for (let index = 0; index < 20000; index++) {
      assert.equal(e.scalar(index), index === 0 ? 0 : index + 1)
    }
    assert.equal(e.heap(), initial)
    const pointer = e.recursive(100)
    const fields = (address) => [0, 4].map((offset) => new DataView(e.memory.buffer).getInt32(address + offset, true))
    assert.deepEqual(fields(pointer), [120, 222])
    assert.equal(e.heap(), initial + 8)
    const retained = e.retain(pointer)
    assert.equal(retained, pointer)
    assert.equal(e.heap(), initial + 8)
    assert.deepEqual(fields(retained), [120, 222])
    assert.equal(e.scalar(1000), 1001)
    assert.deepEqual(fields(pointer), [120, 222])
    assert.deepEqual(fields(retained), [120, 222])
    const escaped = e.escape()
    assert.equal(e.scalar(1000), 1001)
    assert.equal(new Uint8Array(e.memory.buffer)[escaped], 99)
    assert.equal(e.mutate(escaped, 1), 41)
    assert.equal(new Uint8Array(e.memory.buffer)[escaped], 42)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
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
    module.instance.exports.memory.grow(16)

    const hostInput = join(directory, "host-input.matra")
    const hostOutput = join(directory, "host-output.wasm")
    await writeFile(hostInput, "module demo\nfn answer() -> i32 { return 42 }")
    const hostResult = spawnSync("node", ["crates/matra-seed/host/compile.mjs", output, hostInput, hostOutput], { cwd: root, encoding: "utf8" })
    assert.equal(hostResult.status, 0, hostResult.stderr)
    const hostedModule = await WebAssembly.instantiate(await readFile(hostOutput))
    assert.equal(hostedModule.instance.exports.answer(), 42)

    const pipelineOutput = join(directory, "pipeline-output.wasm")
    const pipelineEnvironment = { ...process.env, MATRA_BOOTSTRAP_CACHE_DIR: join(directory, "bootstrap-cache") }
    const pipelineResult = spawnSync("node", ["crates/matra-seed/host/bootstrap.mjs", "--", hostInput, pipelineOutput], { cwd: root, encoding: "utf8", env: pipelineEnvironment })
    assert.equal(pipelineResult.status, 0, pipelineResult.stderr)
    assert.equal(pipelineResult.stdout, "Built bootstrap compiler cache.\n")
    const cacheEntries = await readdir(pipelineEnvironment.MATRA_BOOTSTRAP_CACHE_DIR)
    assert.equal(cacheEntries.length, 1)
    assert.match(cacheEntries[0], /^[0-9a-f]{64}\.wasm$/)
    const pipelineModule = await WebAssembly.instantiate(await readFile(pipelineOutput))
    assert.equal(pipelineModule.instance.exports.answer(), 42)

    const reproducibleEnvironment = { ...process.env, MATRA_BOOTSTRAP_CACHE_DIR: join(directory, "reproducible-cache") }
    const reproducibleOutput = join(directory, "reproducible-output.wasm")
    const reproducibleResult = spawnSync("node", ["crates/matra-seed/host/bootstrap.mjs", hostInput, reproducibleOutput], { cwd: root, encoding: "utf8", env: reproducibleEnvironment })
    assert.equal(reproducibleResult.status, 0, reproducibleResult.stderr)
    assert.equal(reproducibleResult.stdout, "Built bootstrap compiler cache.\n")
    const reproducibleEntries = await readdir(reproducibleEnvironment.MATRA_BOOTSTRAP_CACHE_DIR)
    assert.deepEqual(reproducibleEntries, cacheEntries)
    assert.deepEqual(
      await readFile(join(reproducibleEnvironment.MATRA_BOOTSTRAP_CACHE_DIR, reproducibleEntries[0])),
      await readFile(join(pipelineEnvironment.MATRA_BOOTSTRAP_CACHE_DIR, cacheEntries[0])),
    )

    const materializedCompiler = join(directory, "matra-bootstrap.wasm")
    const materializedResult = spawnSync("node", ["crates/matra-seed/host/materialize.mjs", "--", materializedCompiler], { cwd: root, encoding: "utf8", env: pipelineEnvironment })
    assert.equal(materializedResult.status, 0, materializedResult.stderr)
    const materializedBytes = await readFile(materializedCompiler)
    const materializedChecksum = createHash("sha256").update(materializedBytes).digest("hex")
    assert.deepEqual(materializedBytes, await readFile(join(pipelineEnvironment.MATRA_BOOTSTRAP_CACHE_DIR, cacheEntries[0])))
    assert.equal(await readFile(`${materializedCompiler}.sha256`, "utf8"), `${materializedChecksum}  matra-bootstrap.wasm\n`)
    assert.equal(materializedResult.stdout, `Using cached bootstrap compiler.\n${materializedChecksum}  matra-bootstrap.wasm\n`)
    const materializedOutput = join(directory, "materialized-output.wasm")
    const materializedHost = spawnSync("node", ["crates/matra-seed/host/compile.mjs", materializedCompiler, hostInput, materializedOutput], { cwd: root, encoding: "utf8" })
    assert.equal(materializedHost.status, 0, materializedHost.stderr)
    const materializedModule = await WebAssembly.instantiate(await readFile(materializedOutput))
    assert.equal(materializedModule.instance.exports.answer(), 42)

    const selfHostResult = spawnSync("node", ["crates/matra-seed/host/verify-self-host.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: { ...pipelineEnvironment, MATRA_SELF_HOST_CACHE: "0", MATRA_SELF_HOST_TIMEOUT_MS: "60000" },
      timeout: 150000,
    })
    assert.equal(selfHostResult.status, 0, selfHostResult.stderr || selfHostResult.error?.message)
    for (const stage of [1, 2, 3]) {
      assert.match(selfHostResult.stdout, new RegExp(`Stage ${stage}: ready \\([0-9a-f]{64}; [0-9.]+s\\)`))
    }
    assert.match(selfHostResult.stdout, /Self-host verification: stage 2 and stage 3 are byte-identical\./)
    assert.doesNotMatch(selfHostResult.stdout, /using cached artifact/)
    assert.doesNotMatch(selfHostResult.stderr, /blocked|RuntimeError|memory access out of bounds/)

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

    const sentinelLiteralSource = new TextEncoder().encode("module demo\nfn negative_one() -> i32 { return -1 }\nexport fn negative_two() -> i32 { return -2 }")
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

    const parameterCallSource = new TextEncoder().encode("module demo\nfn identity(value: i32) -> i32 { return value }\nexport fn answer() -> i32 { return identity(-42) }")
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

    const forwardedParameterSource = new TextEncoder().encode("module demo\nfn identity(value: i32) -> i32 { return value }\nexport fn forward(value: i32) -> i32 { return identity(value) }")
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

    const callFunctionSource = new TextEncoder().encode("module demo\nfn helper() -> i32 { return 42 }\nexport fn answer() -> i32 { return helper() }")
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

    const indexedCallSource = new TextEncoder().encode("module demo\nfn unused() -> i32 { return 1 }\nfn helper() -> i32 { return 42 }\nexport fn answer() -> i32 { return helper() }")
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

    const literalFunctionsSource = new TextEncoder().encode("module demo\nfn first() -> i32 { return 1 }\nexport fn second() -> i32 { return 2 }")
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

    const structSource = new TextEncoder().encode("module demo\nstruct pair { left: i32 right: i32 }\nfn answer() -> i32 { return pair(20, 22).right }")
    const structPointer = module.instance.exports.alloc(structSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, structPointer, structSource.length).set(structSource)
    const structRecordPointer = module.instance.exports.compile(structPointer, structSource.length)
    const structRecord = new DataView(module.instance.exports.memory.buffer, structRecordPointer, 20)
    assert.equal(structRecord.getInt32(0, true), 0)
    const structOutputPointer = structRecord.getInt32(4, true)
    const structOutputLength = structRecord.getInt32(8, true)
    const structOutput = new Uint8Array(module.instance.exports.memory.buffer, structOutputPointer, structOutputLength)
    const compiledStruct = await WebAssembly.instantiate(structOutput)
    assert.equal(compiledStruct.instance.exports.answer(), 22)

    const conditionalSource = new TextEncoder().encode("module demo\nfn classify(value: i32) -> i32 { if value < 0 { return 1 } if value <= 10 { return 2 } if value == 20 { return 3 } if value > 40 { return 4 } if value >= 30 { return 5 } if value != 25 { return 6 } return 7 }")
    const conditionalPointer = module.instance.exports.alloc(conditionalSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, conditionalPointer, conditionalSource.length).set(conditionalSource)
    const conditionalRecordPointer = module.instance.exports.compile(conditionalPointer, conditionalSource.length)
    const conditionalRecord = new DataView(module.instance.exports.memory.buffer, conditionalRecordPointer, 20)
    assert.equal(conditionalRecord.getInt32(0, true), 0)
    const conditionalOutputPointer = conditionalRecord.getInt32(4, true)
    const conditionalOutputLength = conditionalRecord.getInt32(8, true)
    const conditionalOutput = new Uint8Array(module.instance.exports.memory.buffer, conditionalOutputPointer, conditionalOutputLength)
    const compiledConditional = await WebAssembly.instantiate(conditionalOutput)
    assert.equal(compiledConditional.instance.exports.classify(-1), 1)
    assert.equal(compiledConditional.instance.exports.classify(10), 2)
    assert.equal(compiledConditional.instance.exports.classify(20), 3)
    assert.equal(compiledConditional.instance.exports.classify(41), 4)
    assert.equal(compiledConditional.instance.exports.classify(30), 5)
    assert.equal(compiledConditional.instance.exports.classify(26), 6)
    assert.equal(compiledConditional.instance.exports.classify(25), 7)

    const literalFallbackSource = new TextEncoder().encode("module demo\nfn is_space(value: i32) -> i32 { if value == 32 { return 1 } if value == 10 { return 1 } if value == 13 { return 1 } return 0 }")
    const literalFallbackPointer = module.instance.exports.alloc(literalFallbackSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, literalFallbackPointer, literalFallbackSource.length).set(literalFallbackSource)
    const literalFallbackRecordPointer = module.instance.exports.compile(literalFallbackPointer, literalFallbackSource.length)
    const literalFallbackRecord = new DataView(module.instance.exports.memory.buffer, literalFallbackRecordPointer, 20)
    assert.equal(literalFallbackRecord.getInt32(0, true), 0)
    const literalFallbackOutputPointer = literalFallbackRecord.getInt32(4, true)
    const literalFallbackOutputLength = literalFallbackRecord.getInt32(8, true)
    const literalFallbackOutput = new Uint8Array(module.instance.exports.memory.buffer, literalFallbackOutputPointer, literalFallbackOutputLength)
    const compiledLiteralFallback = await WebAssembly.instantiate(literalFallbackOutput)
    assert.equal(compiledLiteralFallback.instance.exports.is_space(32), 1)
    assert.equal(compiledLiteralFallback.instance.exports.is_space(10), 1)
    assert.equal(compiledLiteralFallback.instance.exports.is_space(13), 1)
    assert.equal(compiledLiteralFallback.instance.exports.is_space(65), 0)

    const conditionalLocalSource = new TextEncoder().encode("module demo\nfn advance(value: i32) -> i32 { if value == 0 { return 0 } let next = value + 1 return next }")
    const conditionalLocalPointer = module.instance.exports.alloc(conditionalLocalSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, conditionalLocalPointer, conditionalLocalSource.length).set(conditionalLocalSource)
    const conditionalLocalRecordPointer = module.instance.exports.compile(conditionalLocalPointer, conditionalLocalSource.length)
    const conditionalLocalRecord = new DataView(module.instance.exports.memory.buffer, conditionalLocalRecordPointer, 20)
    assert.equal(conditionalLocalRecord.getInt32(0, true), 0)
    const conditionalLocalOutputPointer = conditionalLocalRecord.getInt32(4, true)
    const conditionalLocalOutputLength = conditionalLocalRecord.getInt32(8, true)
    const conditionalLocalOutput = new Uint8Array(module.instance.exports.memory.buffer, conditionalLocalOutputPointer, conditionalLocalOutputLength)
    const compiledConditionalLocal = await WebAssembly.instantiate(conditionalLocalOutput)
    assert.equal(compiledConditionalLocal.instance.exports.advance(0), 0)
    assert.equal(compiledConditionalLocal.instance.exports.advance(41), 42)

    const alternatingLocalSource = new TextEncoder().encode("module demo\nfn flow(value: i32) -> i32 { let base = value if base == 0 { return 1 } let next = base + 1 if next == 2 { return 3 } let final = next + 1 return final }")
    const alternatingLocalPointer = module.instance.exports.alloc(alternatingLocalSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, alternatingLocalPointer, alternatingLocalSource.length).set(alternatingLocalSource)
    const alternatingLocalRecordPointer = module.instance.exports.compile(alternatingLocalPointer, alternatingLocalSource.length)
    const alternatingLocalRecord = new DataView(module.instance.exports.memory.buffer, alternatingLocalRecordPointer, 20)
    assert.equal(alternatingLocalRecord.getInt32(0, true), 0)
    const alternatingLocalOutputPointer = alternatingLocalRecord.getInt32(4, true)
    const alternatingLocalOutputLength = alternatingLocalRecord.getInt32(8, true)
    const alternatingLocalOutput = new Uint8Array(module.instance.exports.memory.buffer, alternatingLocalOutputPointer, alternatingLocalOutputLength)
    const compiledAlternatingLocal = await WebAssembly.instantiate(alternatingLocalOutput)
    assert.equal(compiledAlternatingLocal.instance.exports.flow(0), 1)
    assert.equal(compiledAlternatingLocal.instance.exports.flow(1), 3)
    assert.equal(compiledAlternatingLocal.instance.exports.flow(2), 4)

    const conditionalLocalWhileSource = new TextEncoder().encode("module demo\nfn count(value: i32) -> i32 { if value == 10 { return 42 } let result = 0 while result < value { result = result + 1 } return result }")
    const conditionalLocalWhilePointer = module.instance.exports.alloc(conditionalLocalWhileSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, conditionalLocalWhilePointer, conditionalLocalWhileSource.length).set(conditionalLocalWhileSource)
    const conditionalLocalWhileRecordPointer = module.instance.exports.compile(conditionalLocalWhilePointer, conditionalLocalWhileSource.length)
    const conditionalLocalWhileRecord = new DataView(module.instance.exports.memory.buffer, conditionalLocalWhileRecordPointer, 20)
    assert.equal(conditionalLocalWhileRecord.getInt32(0, true), 0)
    const conditionalLocalWhileOutputPointer = conditionalLocalWhileRecord.getInt32(4, true)
    const conditionalLocalWhileOutputLength = conditionalLocalWhileRecord.getInt32(8, true)
    const conditionalLocalWhileOutput = new Uint8Array(module.instance.exports.memory.buffer, conditionalLocalWhileOutputPointer, conditionalLocalWhileOutputLength)
    const compiledConditionalLocalWhile = await WebAssembly.instantiate(conditionalLocalWhileOutput)
    assert.equal(compiledConditionalLocalWhile.instance.exports.count(10), 42)
    assert.equal(compiledConditionalLocalWhile.instance.exports.count(0), 0)
    assert.equal(compiledConditionalLocalWhile.instance.exports.count(3), 3)

    const nestedConditionalSource = new TextEncoder().encode("module demo\nfn within(value: i32) -> i32 { if value >= 10 { if value <= 20 { return 1 } } return 0 }")
    const nestedConditionalPointer = module.instance.exports.alloc(nestedConditionalSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, nestedConditionalPointer, nestedConditionalSource.length).set(nestedConditionalSource)
    const nestedConditionalRecordPointer = module.instance.exports.compile(nestedConditionalPointer, nestedConditionalSource.length)
    const nestedConditionalRecord = new DataView(module.instance.exports.memory.buffer, nestedConditionalRecordPointer, 36)
    const nestedConditionalDiagnosticPointer = nestedConditionalRecord.getInt32(12, true)
    const nestedConditionalDiagnosticLength = nestedConditionalRecord.getInt32(16, true)
    const nestedConditionalDiagnostic = new TextDecoder().decode(new Uint8Array(module.instance.exports.memory.buffer, nestedConditionalDiagnosticPointer, nestedConditionalDiagnosticLength))
    assert.equal(nestedConditionalRecord.getInt32(0, true), 0, nestedConditionalDiagnostic)
    const nestedConditionalOutputPointer = nestedConditionalRecord.getInt32(4, true)
    const nestedConditionalOutputLength = nestedConditionalRecord.getInt32(8, true)
    const nestedConditionalOutput = new Uint8Array(module.instance.exports.memory.buffer, nestedConditionalOutputPointer, nestedConditionalOutputLength)
    const compiledNestedConditional = await WebAssembly.instantiate(nestedConditionalOutput)
    assert.equal(compiledNestedConditional.instance.exports.within(15), 1)
    assert.equal(compiledNestedConditional.instance.exports.within(9), 0)
    assert.equal(compiledNestedConditional.instance.exports.within(21), 0)

    const bytesParameterSource = new TextEncoder().encode("module demo\nfn offset(source: bytes, value: i32) -> i32 { return value }")
    const bytesParameterPointer = module.instance.exports.alloc(bytesParameterSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, bytesParameterPointer, bytesParameterSource.length).set(bytesParameterSource)
    const bytesParameterRecordPointer = module.instance.exports.compile(bytesParameterPointer, bytesParameterSource.length)
    const bytesParameterRecord = new DataView(module.instance.exports.memory.buffer, bytesParameterRecordPointer, 20)
    assert.equal(bytesParameterRecord.getInt32(0, true), 0)
    const bytesParameterOutputPointer = bytesParameterRecord.getInt32(4, true)
    const bytesParameterOutputLength = bytesParameterRecord.getInt32(8, true)
    const bytesParameterOutput = new Uint8Array(module.instance.exports.memory.buffer, bytesParameterOutputPointer, bytesParameterOutputLength)
    const compiledBytesParameter = await WebAssembly.instantiate(bytesParameterOutput)
    assert.equal(compiledBytesParameter.instance.exports.offset(100, 5, 42), 42)

    const structParameterSource = new TextEncoder().encode("module demo\nstruct pair { left: i32 right: i32 }\nfn retain(value: pair) -> i32 { return value }")
    const structParameterPointer = module.instance.exports.alloc(structParameterSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, structParameterPointer, structParameterSource.length).set(structParameterSource)
    const structParameterRecordPointer = module.instance.exports.compile(structParameterPointer, structParameterSource.length)
    const structParameterRecord = new DataView(module.instance.exports.memory.buffer, structParameterRecordPointer, 20)
    assert.equal(structParameterRecord.getInt32(0, true), 0)
    const structParameterOutputPointer = structParameterRecord.getInt32(4, true)
    const structParameterOutputLength = structParameterRecord.getInt32(8, true)
    const structParameterOutput = new Uint8Array(module.instance.exports.memory.buffer, structParameterOutputPointer, structParameterOutputLength)
    const compiledStructParameter = await WebAssembly.instantiate(structParameterOutput)
    assert.equal(compiledStructParameter.instance.exports.retain(42), 42)

    const structFieldInitializerSource = new TextEncoder().encode("module demo\nstruct pair { left: i32 right: i32 }\nfn make() -> pair { return pair(0, 0) }\nexport fn field_values(value: pair, expected: i32) -> i32 { let saved = value.left if expected == 0 { return 0 } let saved_after = value.right return saved + saved_after }")
    const structFieldInitializerPointer = module.instance.exports.alloc(structFieldInitializerSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, structFieldInitializerPointer, structFieldInitializerSource.length).set(structFieldInitializerSource)
    const structFieldInitializerRecordPointer = module.instance.exports.compile(structFieldInitializerPointer, structFieldInitializerSource.length)
    const structFieldInitializerRecord = new DataView(module.instance.exports.memory.buffer, structFieldInitializerRecordPointer, 20)
    assert.equal(structFieldInitializerRecord.getInt32(0, true), 0)
    const structFieldInitializerOutputPointer = structFieldInitializerRecord.getInt32(4, true)
    const structFieldInitializerOutputLength = structFieldInitializerRecord.getInt32(8, true)
    const structFieldInitializerOutput = new Uint8Array(module.instance.exports.memory.buffer, structFieldInitializerOutputPointer, structFieldInitializerOutputLength)
    const compiledStructFieldInitializer = await WebAssembly.instantiate(structFieldInitializerOutput)
    const structFieldInitializerMemory = new DataView(compiledStructFieldInitializer.instance.exports.memory.buffer)
    structFieldInitializerMemory.setInt32(0, 11, true)
    structFieldInitializerMemory.setInt32(4, 42, true)
    assert.equal(compiledStructFieldInitializer.instance.exports.field_values(0, 1), 53)

    const structWhileSource = new TextEncoder().encode("module demo\nstruct pair { left: i32 right: i32 }\nfn make() -> pair { return pair(0, 0) }\nexport fn total(value: pair) -> i32 { let position = 0 while position < value.left + value.right { position = position + 1 } return position }")
    const structWhilePointer = module.instance.exports.alloc(structWhileSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, structWhilePointer, structWhileSource.length).set(structWhileSource)
    const structWhileRecordPointer = module.instance.exports.compile(structWhilePointer, structWhileSource.length)
    const structWhileRecord = new DataView(module.instance.exports.memory.buffer, structWhileRecordPointer, 20)
    assert.equal(structWhileRecord.getInt32(0, true), 0)
    const structWhileOutputPointer = structWhileRecord.getInt32(4, true)
    const structWhileOutputLength = structWhileRecord.getInt32(8, true)
    const structWhileOutput = new Uint8Array(module.instance.exports.memory.buffer, structWhileOutputPointer, structWhileOutputLength)
    const compiledStructWhile = await WebAssembly.instantiate(structWhileOutput)
    const structWhileMemory = new DataView(compiledStructWhile.instance.exports.memory.buffer)
    structWhileMemory.setInt32(0, 2, true)
    structWhileMemory.setInt32(4, 3, true)
    assert.equal(compiledStructWhile.instance.exports.total(0), 5)

    const structComparisonSource = new TextEncoder().encode("module demo\nstruct pair { left: i32 right: i32 }\nfn make() -> pair { return pair(0, 0) }\nexport fn equal(value: pair) -> i32 { if value.left == value.right { return 1 } return 0 }")
    const structComparisonPointer = module.instance.exports.alloc(structComparisonSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, structComparisonPointer, structComparisonSource.length).set(structComparisonSource)
    const structComparisonRecordPointer = module.instance.exports.compile(structComparisonPointer, structComparisonSource.length)
    const structComparisonRecord = new DataView(module.instance.exports.memory.buffer, structComparisonRecordPointer, 20)
    assert.equal(structComparisonRecord.getInt32(0, true), 0)
    const structComparisonOutputPointer = structComparisonRecord.getInt32(4, true)
    const structComparisonOutputLength = structComparisonRecord.getInt32(8, true)
    const structComparisonOutput = new Uint8Array(module.instance.exports.memory.buffer, structComparisonOutputPointer, structComparisonOutputLength)
    const compiledStructComparison = await WebAssembly.instantiate(structComparisonOutput)
    const structComparisonMemory = new DataView(compiledStructComparison.instance.exports.memory.buffer)
    structComparisonMemory.setInt32(0, 7, true)
    structComparisonMemory.setInt32(4, 7, true)
    assert.equal(compiledStructComparison.instance.exports.equal(0), 1)
    structComparisonMemory.setInt32(4, 8, true)
    assert.equal(compiledStructComparison.instance.exports.equal(0), 0)

    const structConditionalSource = new TextEncoder().encode("module demo\nstruct pair { left: i32 right: i32 }\nfn make() -> pair { return pair(0, 0) }\nfn read(value: i32) -> i32 { return value }\nexport fn matches(source: bytes, value: pair) -> i32 { if read(value.left + 1) == 7 { return 1 } return 0 }")
    const structConditionalPointer = module.instance.exports.alloc(structConditionalSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, structConditionalPointer, structConditionalSource.length).set(structConditionalSource)
    const structConditionalRecordPointer = module.instance.exports.compile(structConditionalPointer, structConditionalSource.length)
    const structConditionalRecord = new DataView(module.instance.exports.memory.buffer, structConditionalRecordPointer, 20)
    assert.equal(structConditionalRecord.getInt32(0, true), 0)
    const structConditionalOutputPointer = structConditionalRecord.getInt32(4, true)
    const structConditionalOutputLength = structConditionalRecord.getInt32(8, true)
    const structConditionalOutput = new Uint8Array(module.instance.exports.memory.buffer, structConditionalOutputPointer, structConditionalOutputLength)
    const compiledStructConditional = await WebAssembly.instantiate(structConditionalOutput)
    const structConditionalMemory = new DataView(compiledStructConditional.instance.exports.memory.buffer)
    structConditionalMemory.setInt32(0, 6, true)
    structConditionalMemory.setInt32(4, 20, true)
    assert.equal(compiledStructConditional.instance.exports.matches(100, 0, 0), 1)
    structConditionalMemory.setInt32(0, 5, true)
    assert.equal(compiledStructConditional.instance.exports.matches(100, 0, 0), 0)

    const structReturnSource = new TextEncoder().encode("module demo\nstruct pair { left: i32 right: i32 }\nfn make(start: i32, position: i32) -> pair { let saved = start if saved == start { return pair(saved, position - saved) } return saved }")
    const structReturnPointer = module.instance.exports.alloc(structReturnSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, structReturnPointer, structReturnSource.length).set(structReturnSource)
    const structReturnRecordPointer = module.instance.exports.compile(structReturnPointer, structReturnSource.length)
    const structReturnRecord = new DataView(module.instance.exports.memory.buffer, structReturnRecordPointer, 20)
    assert.equal(structReturnRecord.getInt32(0, true), 0)
    const structReturnOutputPointer = structReturnRecord.getInt32(4, true)
    const structReturnOutputLength = structReturnRecord.getInt32(8, true)
    const structReturnOutput = new Uint8Array(module.instance.exports.memory.buffer, structReturnOutputPointer, structReturnOutputLength)
    const compiledStructReturn = await WebAssembly.instantiate(structReturnOutput)
    const pairPointer = compiledStructReturn.instance.exports.make(20, 42)
    const pairMemory = new DataView(compiledStructReturn.instance.exports.memory.buffer)
    assert.equal(pairMemory.getInt32(pairPointer, true), 20)
    assert.equal(pairMemory.getInt32(pairPointer + 4, true), 22)

    const localStructFieldSource = new TextEncoder().encode("module demo\nstruct pair { left: i32 right: i32 }\nfn make() -> pair { return pair(7, 5) }\nexport fn read() -> i32 { let value = make() return value.left * 10 + value.right }")
    const localStructFieldPointer = module.instance.exports.alloc(localStructFieldSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, localStructFieldPointer, localStructFieldSource.length).set(localStructFieldSource)
    const localStructFieldRecordPointer = module.instance.exports.compile(localStructFieldPointer, localStructFieldSource.length)
    const localStructFieldRecord = new DataView(module.instance.exports.memory.buffer, localStructFieldRecordPointer, 20)
    assert.equal(localStructFieldRecord.getInt32(0, true), 0)
    const localStructFieldOutputPointer = localStructFieldRecord.getInt32(4, true)
    const localStructFieldOutputLength = localStructFieldRecord.getInt32(8, true)
    const localStructFieldOutput = new Uint8Array(module.instance.exports.memory.buffer, localStructFieldOutputPointer, localStructFieldOutputLength)
    const compiledLocalStructField = await WebAssembly.instantiate(localStructFieldOutput)
    assert.equal(compiledLocalStructField.instance.exports.read(), 75)

    const localSource = new TextEncoder().encode("module demo\nfn calculate(value: i32) -> i32 { let result = value * 2 + 2 return result }")
    const localPointer = module.instance.exports.alloc(localSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, localPointer, localSource.length).set(localSource)
    const localRecordPointer = module.instance.exports.compile(localPointer, localSource.length)
    const localRecord = new DataView(module.instance.exports.memory.buffer, localRecordPointer, 20)
    assert.equal(localRecord.getInt32(0, true), 0)
    const localOutputPointer = localRecord.getInt32(4, true)
    const localOutputLength = localRecord.getInt32(8, true)
    const localOutput = new Uint8Array(module.instance.exports.memory.buffer, localOutputPointer, localOutputLength)
    const compiledLocal = await WebAssembly.instantiate(localOutput)
    assert.equal(compiledLocal.instance.exports.calculate(20), 42)

    const localCallSource = new TextEncoder().encode("module demo\nfn add(left: i32, right: i32) -> i32 { let result = left + right return result }\nexport fn calculate(value: i32) -> i32 { let result = add(value, 2) return result }")
    const localCallPointer = module.instance.exports.alloc(localCallSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, localCallPointer, localCallSource.length).set(localCallSource)
    const localCallRecordPointer = module.instance.exports.compile(localCallPointer, localCallSource.length)
    const localCallRecord = new DataView(module.instance.exports.memory.buffer, localCallRecordPointer, 20)
    assert.equal(localCallRecord.getInt32(0, true), 0)
    const localCallOutputPointer = localCallRecord.getInt32(4, true)
    const localCallOutputLength = localCallRecord.getInt32(8, true)
    const localCallOutput = new Uint8Array(module.instance.exports.memory.buffer, localCallOutputPointer, localCallOutputLength)
    const compiledLocalCall = await WebAssembly.instantiate(localCallOutput)
    assert.equal(compiledLocalCall.instance.exports.calculate(40), 42)

    const localFieldArgumentSource = new TextEncoder().encode("module demo\nstruct span { start: i32 length: i32 }\nfn make() -> span { return span(0, 0) }\nfn sum(left: i32, right: i32) -> i32 { let result = left + right return result }\nexport fn resolve(value: span, delta: i32) -> i32 { let total = sum(value.start + delta, value.length + 1) return total }")
    const localFieldArgumentPointer = module.instance.exports.alloc(localFieldArgumentSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, localFieldArgumentPointer, localFieldArgumentSource.length).set(localFieldArgumentSource)
    const localFieldArgumentRecordPointer = module.instance.exports.compile(localFieldArgumentPointer, localFieldArgumentSource.length)
    const localFieldArgumentRecord = new DataView(module.instance.exports.memory.buffer, localFieldArgumentRecordPointer, 20)
    assert.equal(localFieldArgumentRecord.getInt32(0, true), 0)
    const localFieldArgumentOutputPointer = localFieldArgumentRecord.getInt32(4, true)
    const localFieldArgumentOutputLength = localFieldArgumentRecord.getInt32(8, true)
    const localFieldArgumentOutput = new Uint8Array(module.instance.exports.memory.buffer, localFieldArgumentOutputPointer, localFieldArgumentOutputLength)
    const compiledLocalFieldArgument = await WebAssembly.instantiate(localFieldArgumentOutput)
    const localFieldArgumentMemory = new DataView(compiledLocalFieldArgument.instance.exports.memory.buffer)
    localFieldArgumentMemory.setInt32(0, 5, true)
    localFieldArgumentMemory.setInt32(4, 7, true)
    assert.equal(compiledLocalFieldArgument.instance.exports.resolve(0, 3), 16)

    const whileSource = new TextEncoder().encode("module demo\nfn increment(value: i32) -> i32 { let result = value + 1 return result }\nexport fn count(value: i32) -> i32 { let result = 0 while result < value { result = result + increment(0) - 0 } if result == value { return 7 } let final = increment(result) if increment(increment(final)) == 3 { while final < 2 { final = final + 1 } return final } return final }")
    const whilePointer = module.instance.exports.alloc(whileSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, whilePointer, whileSource.length).set(whileSource)
    const whileRecordPointer = module.instance.exports.compile(whilePointer, whileSource.length)
    const whileRecord = new DataView(module.instance.exports.memory.buffer, whileRecordPointer, 20)
    assert.equal(whileRecord.getInt32(0, true), 0)
    const whileOutputPointer = whileRecord.getInt32(4, true)
    const whileOutputLength = whileRecord.getInt32(8, true)
    const whileOutput = new Uint8Array(module.instance.exports.memory.buffer, whileOutputPointer, whileOutputLength)
    const compiledWhile = await WebAssembly.instantiate(whileOutput)
    assert.equal(compiledWhile.instance.exports.count(5), 7)
    assert.equal(compiledWhile.instance.exports.count(-1), 2)

    const whileLocalSource = new TextEncoder().encode("module demo\nfn increment(value: i32) -> i32 { let result = value + 1 return result }\nexport fn count(value: i32) -> i32 { let result = 0 while result < value { let next = increment(result) result = next } return result }")
    const whileLocalPointer = module.instance.exports.alloc(whileLocalSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, whileLocalPointer, whileLocalSource.length).set(whileLocalSource)
    const whileLocalRecordPointer = module.instance.exports.compile(whileLocalPointer, whileLocalSource.length)
    const whileLocalRecord = new DataView(module.instance.exports.memory.buffer, whileLocalRecordPointer, 20)
    assert.equal(whileLocalRecord.getInt32(0, true), 0)
    const whileLocalOutputPointer = whileLocalRecord.getInt32(4, true)
    const whileLocalOutputLength = whileLocalRecord.getInt32(8, true)
    const whileLocalOutput = new Uint8Array(module.instance.exports.memory.buffer, whileLocalOutputPointer, whileLocalOutputLength)
    const compiledWhileLocal = await WebAssembly.instantiate(whileLocalOutput)
    assert.equal(compiledWhileLocal.instance.exports.count(5), 5)

    const whileConditionalSource = new TextEncoder().encode("module demo\nfn is_two(value: i32) -> i32 { if value == 2 { return 1 } return 0 }\nexport fn count(value: i32) -> i32 { let result = 0 while result < value { if is_two(result) == 1 { result = result + 2 } else { result = result + 1 } } return result }")
    const whileConditionalPointer = module.instance.exports.alloc(whileConditionalSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, whileConditionalPointer, whileConditionalSource.length).set(whileConditionalSource)
    const whileConditionalRecordPointer = module.instance.exports.compile(whileConditionalPointer, whileConditionalSource.length)
    const whileConditionalRecord = new DataView(module.instance.exports.memory.buffer, whileConditionalRecordPointer, 20)
    assert.equal(whileConditionalRecord.getInt32(0, true), 0)
    const whileConditionalOutputPointer = whileConditionalRecord.getInt32(4, true)
    const whileConditionalOutputLength = whileConditionalRecord.getInt32(8, true)
    const whileConditionalOutput = new Uint8Array(module.instance.exports.memory.buffer, whileConditionalOutputPointer, whileConditionalOutputLength)
    const compiledWhileConditional = await WebAssembly.instantiate(whileConditionalOutput)
    assert.equal(compiledWhileConditional.instance.exports.count(5), 5)

    const whileConditionalFieldSource = new TextEncoder().encode("module demo\nstruct pair { left: i32 right: i32 }\nfn make() -> pair { return pair(0, 0) }\nfn read(value: i32) -> i32 { return value }\nexport fn matches(value: pair, index: i32) -> i32 { let result = 0 while result < 1 { if read(value.left + index) == read(value.right + index) { return 1 } else { result = result + 2 } } return result }")
    const whileConditionalFieldPointer = module.instance.exports.alloc(whileConditionalFieldSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, whileConditionalFieldPointer, whileConditionalFieldSource.length).set(whileConditionalFieldSource)
    const whileConditionalFieldRecordPointer = module.instance.exports.compile(whileConditionalFieldPointer, whileConditionalFieldSource.length)
    const whileConditionalFieldRecord = new DataView(module.instance.exports.memory.buffer, whileConditionalFieldRecordPointer, 20)
    assert.equal(whileConditionalFieldRecord.getInt32(0, true), 0)
    const whileConditionalFieldOutputPointer = whileConditionalFieldRecord.getInt32(4, true)
    const whileConditionalFieldOutputLength = whileConditionalFieldRecord.getInt32(8, true)
    const whileConditionalFieldOutput = new Uint8Array(module.instance.exports.memory.buffer, whileConditionalFieldOutputPointer, whileConditionalFieldOutputLength)
    const compiledWhileConditionalField = await WebAssembly.instantiate(whileConditionalFieldOutput)
    const whileConditionalFieldMemory = new DataView(compiledWhileConditionalField.instance.exports.memory.buffer)
    whileConditionalFieldMemory.setInt32(0, 5, true)
    whileConditionalFieldMemory.setInt32(4, 5, true)
    assert.equal(compiledWhileConditionalField.instance.exports.matches(0, 2), 1)
    whileConditionalFieldMemory.setInt32(4, 4, true)
    assert.equal(compiledWhileConditionalField.instance.exports.matches(0, 1), 2)

    const whileBreakSource = new TextEncoder().encode("module demo\nfn identity(value: i32) -> i32 { return value }\nfn is_zero(value: i32) -> i32 { if value == 0 { return 1 } return 0 }\nexport fn stop_before(limit: i32) -> i32 { let result = 0 while result < 10 { if is_zero(identity(result)) == 1 { while result < 1 { result = result + 1 } } else { if result >= 0 { if result + 1 == limit { break } } else { break } result = result + 1 } } return result }")
    const whileBreakPointer = module.instance.exports.alloc(whileBreakSource.length)
    new Uint8Array(module.instance.exports.memory.buffer, whileBreakPointer, whileBreakSource.length).set(whileBreakSource)
    const whileBreakRecordPointer = module.instance.exports.compile(whileBreakPointer, whileBreakSource.length)
    const whileBreakRecord = new DataView(module.instance.exports.memory.buffer, whileBreakRecordPointer, 20)
    assert.equal(whileBreakRecord.getInt32(0, true), 0)
    const whileBreakOutputPointer = whileBreakRecord.getInt32(4, true)
    const whileBreakOutputLength = whileBreakRecord.getInt32(8, true)
    const whileBreakOutput = new Uint8Array(module.instance.exports.memory.buffer, whileBreakOutputPointer, whileBreakOutputLength)
    const compiledWhileBreak = await WebAssembly.instantiate(whileBreakOutput)
    assert.equal(compiledWhileBreak.instance.exports.stop_before(4), 3)

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
      "export fn answer() -> i32 { return value128() }",
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
