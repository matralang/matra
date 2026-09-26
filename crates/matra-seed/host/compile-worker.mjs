import { parentPort, workerData } from "node:worker_threads"
import { formatCompilerDiagnostic, reserveCompilerWorkspace } from "./compiler-host.mjs"

const compiler = await WebAssembly.instantiate(workerData.compilerBytes)
const { alloc, compile: compileSource, memory } = compiler.instance.exports
const source = new Uint8Array(workerData.source)
memory.grow(Math.ceil(source.length / 65536) + 2)
const sourcePointer = alloc(source.length)
new Uint8Array(memory.buffer, sourcePointer, source.length).set(source)
reserveCompilerWorkspace(compiler.instance.exports, sourcePointer, source.length)
const recordPointer = compileSource(sourcePointer, source.length)
const record = new DataView(memory.buffer, recordPointer, 36)
if (record.getInt32(0, true) !== 0) {
  parentPort.postMessage({
    diagnostic: formatCompilerDiagnostic(source, memory, recordPointer, workerData.compilerSourcePath),
  })
} else {
  const outputPointer = record.getInt32(4, true)
  const outputLength = record.getInt32(8, true)
  const output = new Uint8Array(memory.buffer, outputPointer, outputLength).slice()
  try {
    await WebAssembly.compile(output)
    parentPort.postMessage({ output }, [output.buffer])
  } catch (error) {
    if (!(error instanceof WebAssembly.CompileError)) throw error
    parentPort.postMessage({ diagnostic: `Generated WebAssembly is invalid: ${error.message}` })
  }
}
