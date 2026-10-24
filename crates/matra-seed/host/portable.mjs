import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { CommandError, cachedCompiler } from "./bootstrap-compiler.mjs"
import { instantiatePortable, PortableRuntimeError, projectPath } from "./node-runtime.mjs"

const arguments_ = process.argv.slice(2)
if (arguments_[0] === "--") arguments_.shift()
const [command, root, input, ...rest] = arguments_

try {
  if (command === "build" && root && input && rest.length === 1) {
    const inputPath = projectPath(root, input)
    const outputPath = projectPath(root, rest[0], { write: true })
    if (inputPath === outputPath) {
      throw new PortableRuntimeError(
        "INVALID_ARGUMENT",
        "Build output must not overwrite its source",
      )
    }
    const compiler = await cachedCompiler()
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("compile.mjs", import.meta.url)), compiler, inputPath, outputPath],
      { stdio: "inherit" },
    )
    if (result.error) throw result.error
    if (result.signal) throw new Error(`Compiler terminated by ${result.signal}`)
    process.exitCode = result.status ?? 1
  } else if (command === "run" && root && input) {
    const bytes = await readFile(projectPath(root, input))
    const program = await instantiatePortable(bytes, { root, args: rest })
    program.run()
  } else {
    throw new PortableRuntimeError(
      "INVALID_ARGUMENT",
      "Usage: pnpm portable -- build ROOT SOURCE.matra OUTPUT.wasm\n" +
        "       pnpm portable -- run ROOT PROGRAM.wasm [ARGS...]",
    )
  }
} catch (error) {
  if (error instanceof CommandError) {
    process.stderr.write(error.stderr)
    process.exitCode = error.exitCode
  } else {
    const code = error instanceof PortableRuntimeError ? `${error.code}: ` : ""
    console.error(`${code}${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
