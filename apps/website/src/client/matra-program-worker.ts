type CompilerResult = {
  id: number
  output?: ArrayBuffer
  result?: string
  error?: string
}

self.addEventListener("message", async event => {
  const { id, source, filename } = event.data as { id: number, source: string, filename: string }
  try {
    const compilerResponse = await fetch(new URL("./matra-program-compiler.wasm", self.location.href))
    if (!compilerResponse.ok) throw new Error(`Could not load the Matra Program compiler (${compilerResponse.status}).`)
    const compiler = await WebAssembly.instantiate(await compilerResponse.arrayBuffer())
    const exports = compiler.instance.exports as {
      alloc: (size: number) => number
      compile: (pointer: number, length: number) => number
      memory: WebAssembly.Memory
    }
    const input = new TextEncoder().encode(source)
    exports.memory.grow(Math.ceil((input.length * 4) / 65536) + 2)
    const inputPointer = exports.alloc(input.length)
    new Uint8Array(exports.memory.buffer, inputPointer, input.length).set(input)

    const recordPointer = exports.compile(inputPointer, input.length)
    const record = new DataView(exports.memory.buffer, recordPointer, 36)
    if (record.getInt32(0, true) !== 0) {
      throw new SyntaxError(formatCompilerDiagnostic(input, exports.memory, recordPointer, filename))
    }

    const outputPointer = record.getInt32(4, true)
    const outputLength = record.getInt32(8, true)
    const output = new Uint8Array(exports.memory.buffer, outputPointer, outputLength).slice()
    const module = await WebAssembly.compile(output)
    const generated = await WebAssembly.instantiate(module)
    const result = Object.entries(generated.exports)
      .filter(([, value]) => typeof value === "function")
      .map(([name, value]) => {
        const fn = value as Function
        return fn.length === 0 ? `${name}() = ${String(fn())}` : `${name}(${fn.length} argument${fn.length === 1 ? "" : "s"})`
      })
      .join("\n") || "Compiled successfully. The module has no exported functions."
    const response: CompilerResult = { id, output: output.buffer, result }
    self.postMessage(response, [output.buffer])
  } catch (error) {
    const response: CompilerResult = { id, error: error instanceof Error ? error.message : String(error) }
    self.postMessage(response)
  }
})

function formatCompilerDiagnostic(source: Uint8Array, memory: WebAssembly.Memory, recordPointer: number, filename: string): string {
  const record = new DataView(memory.buffer, recordPointer, 36)
  const code = record.getInt32(20, true)
  const offset = record.getInt32(24, true)
  const length = record.getInt32(28, true)
  const expected = record.getInt32(32, true)
  const labels = ["", "parse error", "unknown function", "argument count mismatch"]
  const expectedLabels = ["", "module", "identifier", "fn", "(", "parameter or )", ":", "i32", "-", ">", "{", "return", "value", "integer", ")", "}"]
  const prefix = new TextDecoder().decode(source.slice(0, offset))
  const lines = prefix.split("\n")
  const line = lines.length
  const column = lines.at(-1)!.length + 1
  const lineStart = source.lastIndexOf(10, offset - 1) + 1
  const nextNewline = source.indexOf(10, offset)
  const lineEnd = nextNewline === -1 ? source.length : nextNewline
  const excerpt = new TextDecoder().decode(source.slice(lineStart, lineEnd))
  const underline = `${" ".repeat(offset - lineStart)}${"^".repeat(Math.max(1, length))}`
  const expectation = code === 1 && expectedLabels[expected] ? `: expected ${expectedLabels[expected]}` : ""
  return `${filename}:${line}:${column}: ${labels[code] ?? "compiler error"}${expectation}\n${excerpt}\n${underline}`
}
