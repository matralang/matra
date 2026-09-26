import assert from "node:assert/strict"
import { instantiateUnified } from "./unified-host.mjs"
import { createHash } from "node:crypto"
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { Worker } from "node:worker_threads"
import { fileURLToPath } from "node:url"
import { cachedCompiler, CommandError } from "./bootstrap-compiler.mjs"

const compilerSourcePath = fileURLToPath(new URL("../examples/compiler.md", import.meta.url))
const artifactCacheDirectory = fileURLToPath(new URL("../target/bootstrap/self-host", import.meta.url))

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
        for (const [name, compiler] of [["Stage 1", stage1], ["Stage 2", stage2.output], ["Stage 3", stage3.output]]) {
          await verifyUnified(name, compiler)
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

function programSource(markdown, fenceName) {
  const opening = `\`\`\`${fenceName}\n`
  const start = markdown.indexOf(opening)
  if (start < 0) throw new Error(`Program fence not found: ${fenceName}`)
  const sourceStart = start + opening.length
  const end = markdown.indexOf("\n```", sourceStart)
  if (end < 0) throw new Error(`Program fence is not closed: ${fenceName}`)
  return markdown.slice(sourceStart, end)
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
      resolve({ output: result.output ? Buffer.from(result.output) : undefined, diagnostic: result.diagnostic })
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
  const key = createHash("sha256")
    .update(stage)
    .update(compilerBytes)
    .update(source)
    .digest("hex")
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

// bootstrap の一致だけでなく、各段階の compiler が統一文法を実行可能な Wasm にすることを確認する。
async function verifyUnified(name, compiler) {
  const fixtures = JSON.parse(await readFile(new URL("../../../spec/fixtures/unified.json", import.meta.url), "utf8"))
  for (const fixture of fixtures.accept) {
    const result = await compile(compiler, new TextEncoder().encode(fixture.source))
    assert.ok(result.output, `${name}: ${fixture.name}: ${result.diagnostic}`)
    const instance = await instantiateUnified(result.output)
    assert.deepEqual(instance.run(), fixture.value, `${name}: ${fixture.name}`)
  }
  for (const source of fixtures.reject) {
    const result = await compile(compiler, new TextEncoder().encode(source))
    if (!result.output) {
      assert.doesNotMatch(result.diagnostic, /exceeded|unreachable|out of bounds|Generated WebAssembly is invalid/i)
      continue
    }
    const instance = await instantiateUnified(result.output)
    assert.throws(() => instance.run(), error => !(error instanceof WebAssembly.RuntimeError), `${name}: unexpected acceptance: ${source}`)
  }
  const native = await compile(compiler, new TextEncoder().encode(`module regression
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
}`))
  assert.ok(native.output, `${name}: native statement regression: ${native.diagnostic}`)
  const { instance } = await WebAssembly.instantiate(native.output)
  assert.equal(instance.exports.answer(), -1)
  console.log(`${name}: unified grammar conformance (${fixtures.accept.length + fixtures.reject.length} cases).`)
}
