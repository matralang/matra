import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { Worker } from "node:worker_threads"
import { cachedCompiler } from "../../../crates/matra-seed/host/bootstrap-compiler.mjs"
import { LITERATE_ABI } from "../src/literate/compiler.mjs"
import { programSource } from "../src/literate/compiler-host.mjs"

const sourceURL = new URL("../../../crates/matra-seed/examples/compiler.md", import.meta.url)
const source = new TextEncoder().encode(
  programSource(await readFile(sourceURL, "utf8"), "compiler.matra"),
)
const seed = await readFile(await cachedCompiler())
const digest = bytes => createHash("sha256").update(bytes).digest("hex")
const key = digest(Buffer.concat([seed, source]))
const cache = new URL(`../../../crates/matra-seed/target/core-compiler/${key}/`, import.meta.url)
await mkdir(cache, { recursive: true })

async function stage(bytes, name) {
  const path = new URL(`${name}.wasm`, cache)
  try {
    const cached = await readFile(path)
    await WebAssembly.compile(cached)
    return cached
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  const output = await new Promise((resolve, reject) => {
    let received = false
    const worker = new Worker(
      new URL("../../../crates/matra-seed/host/compile-worker.mjs", import.meta.url),
      {
        workerData: { compilerBytes: bytes, source, compilerSourcePath: fileURLToPath(sourceURL) },
      },
    )
    const timer = setTimeout(() => {
      worker.terminate()
      reject(new Error(`${name} compiler generation timed out`))
    }, 180000)
    worker.once("message", result => {
      received = true
      clearTimeout(timer)
      worker.terminate()
      if (result.output) resolve(Buffer.from(result.output))
      else reject(new Error(result.diagnostic))
    })
    worker.once("error", error => {
      clearTimeout(timer)
      reject(error)
    })
    worker.once("exit", code => {
      clearTimeout(timer)
      if (!received) reject(new Error(`${name} compiler worker exited without a result (${code})`))
    })
  })
  await writeFile(path, output)
  return output
}

const stage2 = await stage(seed, "stage2")
const stage3 = await stage(stage2, "stage3")
assert.deepEqual(stage2, stage3, "Stage 2 and Stage 3 compiler Wasm must be byte-identical")
const output = new URL("../dist/literate/", import.meta.url)
await mkdir(output, { recursive: true })
await writeFile(new URL("compiler.wasm", output), stage2)
const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
await writeFile(
  new URL("compiler.json", output),
  `${JSON.stringify(
    {
      version,
      abi: LITERATE_ABI,
      sha256: digest(stage2),
      sourceSha256: digest(source),
      bytes: stage2.length,
      stage2EqualsStage3: true,
    },
    null,
    2,
  )}\n`,
)
console.log(
  `Bundled compiler: ${stage2.length} bytes, sha256=${digest(stage2)} (Stage 2/3 identical)`,
)
