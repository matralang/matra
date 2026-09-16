import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { Worker } from "node:worker_threads"
import { fileURLToPath } from "node:url"
import { cachedCompiler, CommandError } from "./bootstrap-compiler.mjs"

const compilerSourcePath = fileURLToPath(new URL("../examples/compiler.md", import.meta.url))

try {
  const markdown = await readFile(compilerSourcePath, "utf8")
  const source = new TextEncoder().encode(programSource(markdown, "compiler.matra.program"))
  const verificationStarted = performance.now()
  const stage1 = await readFile(await cachedCompiler())
  console.log(`Stage 1: ready (${checksum(stage1)}; ${elapsedSeconds(verificationStarted)}s)`)

  const stage2Started = performance.now()
  const stage2 = await compile(stage1, source)
  if (!stage2.output) {
    console.error("Stage 2: blocked")
    console.error(`${stage2.diagnostic} (${elapsedSeconds(stage2Started)}s)`)
    process.exitCode = 1
  } else {
    console.log(`Stage 2: ready (${checksum(stage2.output)}; ${elapsedSeconds(stage2Started)}s)`)
    const stage3Started = performance.now()
    const stage3 = await compile(stage2.output, source)
    if (!stage3.output) {
      console.error("Stage 3: blocked")
      console.error(`${stage3.diagnostic} (${elapsedSeconds(stage3Started)}s)`)
      process.exitCode = 1
    } else {
      console.log(`Stage 3: ready (${checksum(stage3.output)}; ${elapsedSeconds(stage3Started)}s)`)
      if (Buffer.compare(stage2.output, stage3.output) === 0) {
        console.log("Self-host verification: stage 2 and stage 3 are byte-identical.")
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
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./compile-worker.mjs", import.meta.url), {
      workerData: {
        compilerBytes,
        source,
        compilerSourcePath,
      },
    })
    const timer = setTimeout(() => {
      worker.terminate()
      resolve({ diagnostic: `Self-host compile exceeded ${timeout} ms and was terminated.` })
    }, timeout)
    worker.once("message", result => {
      clearTimeout(timer)
      worker.terminate()
      resolve({ output: result.output ? Buffer.from(result.output) : undefined, diagnostic: result.diagnostic })
    })
    worker.once("error", error => {
      clearTimeout(timer)
      worker.terminate()
      reject(error)
    })
  })
}

function checksum(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function elapsedSeconds(started) {
  return ((performance.now() - started) / 1000).toFixed(1)
}
