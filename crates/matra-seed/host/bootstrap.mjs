import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const [inputPath, outputPath, extra] = process.argv.slice(2)
if (!inputPath || !outputPath || extra) {
  fail("Usage: node crates/matra-seed/host/bootstrap.mjs INPUT.matra OUTPUT.wasm")
}

const seedRoot = fileURLToPath(new URL("..", import.meta.url))
const manifest = join(seedRoot, "Cargo.toml")
const compilerSource = join(seedRoot, "examples/compiler.md")
const host = fileURLToPath(new URL("compile.mjs", import.meta.url))
const directory = await mkdtemp(join(tmpdir(), "matra-bootstrap-"))
const compiler = join(directory, "compiler.wasm")

try {
  run("cargo", [
    "run",
    "--quiet",
    "--manifest-path",
    manifest,
    "--",
    compilerSource,
    compiler,
    "--entry",
    "compiler.matra.program",
  ])
  run(process.execPath, [host, compiler, inputPath, outputPath])
} finally {
  await rm(directory, { recursive: true, force: true })
}

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, { encoding: "utf8" })
  if (result.error) fail(result.error.message)
  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}