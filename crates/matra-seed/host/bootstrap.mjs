import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { cachedCompiler, CommandError } from "./bootstrap-compiler.mjs"

const arguments_ = process.argv.slice(2)
if (arguments_[0] === "--") arguments_.shift()
const [inputPath, outputPath, extra] = arguments_
if (!inputPath || !outputPath || extra) {
  console.error("Usage: node crates/matra-seed/host/bootstrap.mjs INPUT.matra OUTPUT.wasm")
  process.exit(1)
}

const host = fileURLToPath(new URL("compile.mjs", import.meta.url))

try {
  const compiler = await cachedCompiler()
  run(process.execPath, [host, compiler, inputPath, outputPath])
} catch (error) {
  if (error instanceof CommandError) {
    process.stderr.write(error.stderr)
    process.exitCode = error.exitCode
  } else {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, { encoding: "utf8" })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new CommandError(result.status ?? 1, result.stderr)
  }
  return result
}