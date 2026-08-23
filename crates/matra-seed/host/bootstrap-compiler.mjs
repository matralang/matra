import { createHash } from "node:crypto"
import { access, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const seedRoot = fileURLToPath(new URL("..", import.meta.url))
const manifest = join(seedRoot, "Cargo.toml")
const compilerSource = join(seedRoot, "examples/compiler.md")

export class CommandError extends Error {
  constructor(exitCode, stderr) {
    super(stderr)
    this.exitCode = exitCode
    this.stderr = stderr
  }
}

export async function cachedCompiler() {
  const cacheRoot = process.env.MATRA_BOOTSTRAP_CACHE_DIR ?? join(seedRoot, "target/bootstrap")
  const key = await compilerCacheKey()
  const compiler = join(cacheRoot, `${key}.wasm`)
  if (await exists(compiler)) {
    console.log("Using cached bootstrap compiler.")
    return compiler
  }

  await mkdir(cacheRoot, { recursive: true })
  const directory = await mkdtemp(join(cacheRoot, "build-"))
  const temporaryCompiler = join(directory, "compiler.wasm")
  try {
    run("cargo", [
      "run",
      "--quiet",
      "--manifest-path",
      manifest,
      "--",
      compilerSource,
      temporaryCompiler,
      "--entry",
      "compiler.matra.program",
    ])
    await rename(temporaryCompiler, compiler)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
  console.log("Built bootstrap compiler cache.")
  return compiler
}

async function compilerCacheKey() {
  const hash = createHash("sha256")
  const inputs = [
    compilerSource,
    join(seedRoot, "src/lib.rs"),
    join(seedRoot, "src/main.rs"),
    manifest,
    join(seedRoot, "Cargo.lock"),
  ]
  for (const input of inputs) {
    hash.update(input.slice(seedRoot.length + 1))
    hash.update(await readFile(input))
  }
  hash.update(run("rustc", ["-Vv"]).stdout)
  return hash.digest("hex")
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, { encoding: "utf8" })
  if (result.error) throw result.error
  if (result.status !== 0) throw new CommandError(result.status ?? 1, result.stderr)
  return result
}