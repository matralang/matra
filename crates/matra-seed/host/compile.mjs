import { readFile, writeFile } from "node:fs/promises"
import { formatCompilerDiagnostic } from "./compiler-host.mjs"

const [compilerPath, inputPath, outputPath, extra] = process.argv.slice(2)
if (!compilerPath || !inputPath || !outputPath || extra) {
  fail("Usage: node crates/matra-seed/host/compile.mjs COMPILER.wasm INPUT.matra OUTPUT.wasm")
}

try {
  const source = await readFile(inputPath)
  const compiler = await WebAssembly.instantiate(await readFile(compilerPath))
  const { alloc, compile, memory } = compiler.instance.exports
  memory.grow(Math.ceil(source.length / 65536) + 2)
  const sourcePointer = alloc(source.length)
  new Uint8Array(memory.buffer, sourcePointer, source.length).set(source)
  const recordPointer = compile(sourcePointer, source.length)
  const record = new DataView(memory.buffer, recordPointer, 36)
  if (record.getInt32(0, true) !== 0) {
    fail(formatCompilerDiagnostic(source, memory, recordPointer, inputPath))
  }
  const outputPointer = record.getInt32(4, true)
  const outputLength = record.getInt32(8, true)
  const output = new Uint8Array(memory.buffer, outputPointer, outputLength).slice()
  await writeFile(outputPath, output)
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

function fail(message) {
  console.error(message)
  process.exit(1)
}