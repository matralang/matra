import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
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
    "export fn first_byte(source: bytes) -> i32 {",
    "  return byte_at(source, 0)",
    "}",
    "",
    "export fn source_length(source: bytes) -> i32 {",
    "  return byte_length(source)",
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
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
