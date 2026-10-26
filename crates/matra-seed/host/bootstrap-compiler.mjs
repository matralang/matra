import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { access, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

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
      "compiler.matra",
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
    join(seedRoot, "src/program.rs"),
    join(seedRoot, "src/native.rs"),
    join(seedRoot, "src/document_wasm.rs"),
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
  if (result.error?.code === "ENOENT") throw missingToolchain(command)
  if (result.error) throw result.error
  if (result.status !== 0) throw new CommandError(result.status ?? 1, result.stderr)
  return result
}

function missingToolchain(command) {
  return new CommandError(
    1,
    `Rust toolchain is required to build the bootstrap compiler: \`${command}\` was not found on PATH.\n` +
      "Install Rust with rustup (https://rustup.rs/); rust-toolchain.toml selects the required version.\n" +
      "On Windows, also install the MSVC C++ build tools, then open a new terminal.\n",
  )
}
