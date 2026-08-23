import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, dirname } from "node:path"
import { cachedCompiler, CommandError } from "./bootstrap-compiler.mjs"

const arguments_ = process.argv.slice(2)
if (arguments_[0] === "--") arguments_.shift()
const [outputPath, extra] = arguments_
if (!outputPath || extra) {
  console.error("Usage: node crates/matra-seed/host/materialize.mjs OUTPUT.wasm")
  process.exit(1)
}

try {
  const compiler = await cachedCompiler()
  const bytes = await readFile(compiler)
  const checksum = createHash("sha256").update(bytes).digest("hex")
  const checksumLine = `${checksum}  ${basename(outputPath)}\n`
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, bytes)
  await writeFile(`${outputPath}.sha256`, checksumLine)
  process.stdout.write(checksumLine)
} catch (error) {
  if (error instanceof CommandError) {
    process.stderr.write(error.stderr)
    process.exitCode = error.exitCode
  } else {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}