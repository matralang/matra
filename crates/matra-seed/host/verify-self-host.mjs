import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { Worker } from "node:worker_threads"
import { CommandError, cachedCompiler } from "./bootstrap-compiler.mjs"
import { programSource, sourcePosition } from "./compiler-host.mjs"
import { instantiatePortable } from "./node-runtime.mjs"
import { instantiateMatra } from "./value-host.mjs"

const compilerSourcePath = fileURLToPath(new URL("../examples/compiler.md", import.meta.url))
const artifactCacheDirectory = fileURLToPath(
  new URL("../target/bootstrap/self-host", import.meta.url),
)

try {
  const markdown = await readFile(compilerSourcePath, "utf8")
  const source = new TextEncoder().encode(programSource(markdown, "compiler.matra"))
  const verificationStarted = performance.now()
  const stage1 = await readFile(await cachedCompiler())
  console.log(`Stage 1: ready (${checksum(stage1)}; ${elapsedSeconds(verificationStarted)}s)`)

  const stage2Started = performance.now()
  const stage2 = await compileCached(stage1, source, "stage2")
  if (!stage2.output) {
    console.error("Stage 2: blocked")
    console.error(`${stage2.diagnostic} (${elapsedSeconds(stage2Started)}s)`)
    process.exitCode = 1
  } else {
    console.log(`Stage 2: ready (${checksum(stage2.output)}; ${elapsedSeconds(stage2Started)}s)`)
    const stage3Started = performance.now()
    const stage3 = await compileCached(stage2.output, source, "stage3")
    if (!stage3.output) {
      console.error("Stage 3: blocked")
      console.error(`${stage3.diagnostic} (${elapsedSeconds(stage3Started)}s)`)
      process.exitCode = 1
    } else {
      console.log(`Stage 3: ready (${checksum(stage3.output)}; ${elapsedSeconds(stage3Started)}s)`)
      if (Buffer.compare(stage2.output, stage3.output) === 0) {
        console.log("Self-host verification: stage 2 and stage 3 are byte-identical.")
        for (const [name, compiler] of [
          ["Stage 1", stage1],
          ["Stage 2", stage2.output],
          ["Stage 3", stage3.output],
        ]) {
          await verifyGrammar(name, compiler)
        }
      } else {
        console.error("Self-host verification: stage 2 and stage 3 differ.")
        process.exitCode = 1
      }
    }
  }
} catch (error) {
  if (error instanceof CommandError) {
    console.error(error.stderr)
    process.exitCode = error.exitCode
  } else {
    throw error
  }
}

async function compile(compilerBytes, source) {
  const timeout = Number(process.env.MATRA_SELF_HOST_TIMEOUT_MS ?? 180000)
  const started = performance.now()
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./compile-worker.mjs", import.meta.url), {
      workerData: {
        compilerBytes,
        source,
        compilerSourcePath,
      },
    })
    const heartbeatInterval = Number(process.env.MATRA_SELF_HOST_HEARTBEAT_MS ?? 10000)
    const heartbeat = setInterval(() => {
      console.error(`Self-host compile still running (${elapsedSeconds(started)}s elapsed).`)
    }, heartbeatInterval)
    const timer = setTimeout(() => {
      clearInterval(heartbeat)
      worker.terminate()
      resolve({ diagnostic: `Self-host compile exceeded ${timeout} ms and was terminated.` })
    }, timeout)
    worker.once("message", result => {
      clearTimeout(timer)
      clearInterval(heartbeat)
      worker.terminate()
      resolve({
        output: result.output ? Buffer.from(result.output) : undefined,
        diagnostic: result.diagnostic,
      })
    })
    worker.once("error", error => {
      clearTimeout(timer)
      clearInterval(heartbeat)
      worker.terminate()
      reject(error)
    })
  })
}

async function compileCached(compilerBytes, source, stage) {
  if (process.env.MATRA_SELF_HOST_CACHE === "0") {
    return compile(compilerBytes, source)
  }
  const key = createHash("sha256").update(stage).update(compilerBytes).update(source).digest("hex")
  const cachePath = `${artifactCacheDirectory}/${stage}-${key}.wasm`
  try {
    await access(cachePath)
    const output = await readFile(cachePath)
    await WebAssembly.compile(output)
    console.log(`${stage}: using cached artifact (${checksum(output)})`)
    return { output }
  } catch (error) {
    if (error instanceof WebAssembly.CompileError) {
      await rm(cachePath, { force: true })
    }
    if (error?.code !== "ENOENT") {
      console.error(`${stage}: cache miss (${error.message})`)
    }
  }
  const result = await compile(compilerBytes, source)
  if (result.output) {
    await mkdir(artifactCacheDirectory, { recursive: true })
    await writeFile(cachePath, result.output)
  }
  return result
}

function checksum(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function elapsedSeconds(started) {
  return ((performance.now() - started) / 1000).toFixed(1)
}

// bootstrap の一致だけでなく、各段階の compiler が標準文法を実行可能な Wasm にすることを確認する。
async function verifyGrammar(name, compiler) {
  const fixtures = JSON.parse(
    await readFile(new URL("../../../spec/fixtures/grammar.json", import.meta.url), "utf8"),
  )
  for (const fixture of fixtures.markupDiagnostics) {
    const source = new TextEncoder().encode(fixture.source)
    const result = await compile(compiler, source)
    assert.equal(
      result.output,
      undefined,
      `${name}: unexpected markup acceptance: ${fixture.source}`,
    )
    const offset = Buffer.byteLength(fixture.source.slice(0, fixture.offset))
    const { line, column } = sourcePosition(source, offset)
    assert.ok(
      result.diagnostic.includes(`:${line}:${column}: parse error`),
      `${name}: ${result.diagnostic}`,
    )
  }
  for (const fixture of fixtures.native) {
    const result = await compile(compiler, new TextEncoder().encode(fixture.source))
    assert.ok(result.output, `${name}: ${fixture.name}: ${result.diagnostic}`)
    const { instance } = await WebAssembly.instantiate(result.output)
    assert.equal(instance.exports.answer(), fixture.value, `${name}: ${fixture.name}`)
  }
  for (const source of fixtures.nativeReject) {
    const result = await compile(compiler, new TextEncoder().encode(source))
    assert.equal(result.output, undefined, `${name}: unexpected native acceptance: ${source}`)
    assert.doesNotMatch(
      result.diagnostic,
      /exceeded|unreachable|out of bounds|Generated WebAssembly is invalid/i,
    )
  }
  for (const fixture of fixtures.accept) {
    const result = await compile(compiler, new TextEncoder().encode(fixture.source))
    assert.ok(result.output, `${name}: ${fixture.name}: ${result.diagnostic}`)
    const instance = await instantiateMatra(result.output)
    assert.deepEqual(instance.run(), fixture.value, `${name}: ${fixture.name}`)
  }
  for (const source of fixtures.reject) {
    const result = await compile(compiler, new TextEncoder().encode(source))
    if (!result.output) {
      assert.doesNotMatch(
        result.diagnostic,
        /exceeded|unreachable|out of bounds|Generated WebAssembly is invalid/i,
      )
      continue
    }
    const instance = await instantiateMatra(result.output)
    assert.throws(
      () => instance.run(),
      error => !(error instanceof WebAssembly.RuntimeError),
      `${name}: unexpected acceptance: ${source}`,
    )
  }
  const native = await compile(
    compiler,
    new TextEncoder().encode(`module regression
fn store(values: [i32], value: i32) -> i32 {
  array_set(values, 0, value)
  return array_get(values, 0)
}
fn identity(value: i32) -> i32 { return value }
export fn answer() -> i32 {
  let values = allocate_i32_array(1)
  let count = 0
  let value = 0
  while (count < 1) {
    value = identity(-1)
    count = count + 1
  }
  if (value < 0) {
    let flag = 1
    if (array_get(values, 0 + 0) != 0) { flag = 0 }
    if (flag == 1) { return store(values, value) }
  }
  return 0
}`),
  )
  assert.ok(native.output, `${name}: native statement regression: ${native.diagnostic}`)
  const { instance } = await WebAssembly.instantiate(native.output)
  assert.equal(instance.exports.answer(), -1)
  console.log(
    `${name}: standard grammar conformance (${fixtures.accept.length + fixtures.reject.length} document cases, ${fixtures.native.length + fixtures.nativeReject.length} native cases).`,
  )
  await verifyPortable(name, compiler)
}

async function verifyPortable(name, compiler) {
  const example = new URL("../examples/portable/", import.meta.url)
  const result = await compile(compiler, await readFile(new URL("main.matra", example)))
  assert.ok(result.output, `${name}: portable sample: ${result.diagnostic}`)
  const root = await mkdtemp(join(tmpdir(), "matra-portable-stage-"))
  try {
    const input = await readFile(new URL("input.txt", example), "utf8")
    await writeFile(join(root, "input.txt"), input)
    const output = []
    const program = await instantiatePortable(result.output, {
      root,
      args: ["input.txt"],
      stdout: { write: value => output.push(value) },
    })
    assert.equal(program.run(), null)
    assert.equal(await readFile(join(root, "output.txt"), "utf8"), `Matra v0.3: ${input}`)
    assert.deepEqual(output, ["Wrote output.txt\n"])
    console.log(`${name}: portable file I/O sample passed.`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
