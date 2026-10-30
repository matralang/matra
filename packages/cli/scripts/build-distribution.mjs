import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  chmod,
  copyFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises"
import { createRequire } from "node:module"
import { basename, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { verifyDistribution } from "./verify-distribution.mjs"

const root = fileURLToPath(new URL("../../../", import.meta.url))
const config = JSON.parse(await readFile(new URL("../distribution/node.json", import.meta.url)))
const target = `${process.platform}-${process.arch}`
if (target !== config.target) throw new Error(`Only ${config.target} is supported, not ${target}`)
const args = process.argv.slice(2)
if (args[0] === "--") args.shift()
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--output")) {
  throw new Error("Usage: pnpm distribution:build [--output DIRECTORY]")
}
const output = resolve(args[1] ?? join(root, "dist/releases"))
const cli = JSON.parse(await readFile(new URL("../package.json", import.meta.url)))
const name = `matra-${cli.version}-${target}`
const archive = join(output, `${name}.zip`)
const folder = join(output, name)
const digest = bytes => createHash("sha256").update(bytes).digest("hex")
const manager = process.env.npm_execpath
if (!manager) throw new Error("Run with pnpm distribution:build")
const [managerCommand, ...managerArgs] = /\.(?:c|m)?js$/i.test(manager)
  ? [process.execPath, manager]
  : [manager]
const invoke = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })

async function mustNotExist(path) {
  try {
    await lstat(path)
  } catch (error) {
    if (error.code === "ENOENT") return
    throw error
  }
  throw new Error(`Refusing to overwrite: ${path}. Use --output with another directory.`)
}

await mkdir(output, { recursive: true })
for (const path of [archive, folder, `${archive}.sha256`]) await mustNotExist(path)
const work = await mkdtemp(join(output, ".matra-build-"))

try {
  const stage = join(work, name)
  const modules = join(stage, "app/node_modules")
  const licenses = join(stage, "licenses")
  await mkdir(modules, { recursive: true })
  await mkdir(licenses)
  const nodeURL = `https://nodejs.org/dist/v${config.version}/${config.archive}`
  console.log(`Downloading: ${nodeURL}`)
  const response = await fetch(nodeURL, { signal: AbortSignal.timeout(120000) })
  if (!response.ok) throw new Error(`Node.js download failed: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (digest(bytes) !== config.sha256) throw new Error("Node.js archive checksum mismatch")
  const nodeArchive = join(work, config.archive)
  await writeFile(nodeArchive, bytes)
  const runtime = join(stage, "runtime")
  await mkdir(runtime)
  invoke("tar", [
    "-xzf",
    nodeArchive,
    "-C",
    runtime,
    "--strip-components=1",
    `node-v${config.version}-${target}/bin/node`,
    `node-v${config.version}-${target}/LICENSE`,
  ])
  await copyFile(join(runtime, "LICENSE"), join(licenses, "Node.js.LICENSE"))
  await chmod(join(runtime, "bin/node"), 0o755)
  if (invoke(join(runtime, "bin/node"), ["--version"]).trim() !== `v${config.version}`) {
    throw new Error("Bundled Node.js version mismatch")
  }

  const packages = new Map()
  const workspaces = ["cli", "core", "html", "styles"]
  const sources = new Map()
  for (const workspace of workspaces) {
    const source = join(root, "packages", workspace)
    const manifest = JSON.parse(await readFile(join(source, "package.json")))
    sources.set(manifest.name, source)
  }

  async function include(source) {
    source = await realpath(source)
    const manifest = JSON.parse(await readFile(join(source, "package.json")))
    const previous = packages.get(manifest.name)
    if (previous) {
      if (previous.version !== manifest.version) {
        throw new Error(`Conflicting runtime versions for ${manifest.name}`)
      }
      return
    }
    const destination = join(modules, manifest.name)
    await mkdir(destination, { recursive: true })
    if (sources.has(manifest.name)) {
      const packed = join(work, `${manifest.name.replace("/", "-")}.tgz`)
      invoke(managerCommand, [...managerArgs, "pack", "--out", packed], source)
      invoke("tar", ["-xzf", packed, "-C", destination, "--strip-components=1"])
    } else {
      await cp(source, destination, {
        recursive: true,
        dereference: true,
        filter: path => basename(path) !== "node_modules",
      })
    }
    const licenseName = `${manifest.name.replace("/", "-")}.LICENSE`
    if (sources.has(manifest.name)) {
      await copyFile(join(root, "LICENSE"), join(licenses, licenseName))
    } else {
      const candidates = (await readdir(source)).filter(name => /^licen[cs]e(?:\.|$)/i.test(name))
      if (candidates.length !== 1) throw new Error(`Expected one license file for ${manifest.name}`)
      await copyFile(join(source, candidates[0]), join(licenses, licenseName))
    }
    packages.set(manifest.name, {
      name: manifest.name,
      version: manifest.version,
      license: manifest.license,
      licenseFile: `licenses/${licenseName}`,
    })
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      let dependencySource = sources.get(dependency)
      if (!dependencySource) {
        const require = createRequire(join(source, "package.json"))
        for (const search of require.resolve.paths(dependency)) {
          const candidate = join(search, dependency)
          try {
            await readFile(join(candidate, "package.json"))
            dependencySource = candidate
            break
          } catch (error) {
            if (error.code !== "ENOENT") throw error
          }
        }
      }
      if (!dependencySource) throw new Error(`Missing runtime dependency: ${dependency}`)
      await include(dependencySource)
    }
  }
  await include(sources.get("@matra/cli"))
  await copyFile(new URL("../distribution/matra", import.meta.url), join(stage, "matra"))
  await chmod(join(stage, "matra"), 0o755)
  await copyFile(join(root, "LICENSE"), join(stage, "LICENSE"))
  const compiler = JSON.parse(
    await readFile(join(modules, "@matra/core/dist/literate/compiler.json")),
  )
  const metadata = {
    name,
    version: cli.version,
    target,
    sourceCommit: invoke("git", ["rev-parse", "HEAD"]).trim(),
    sourceDirty: invoke("git", ["status", "--porcelain"]).trim() !== "",
    lockfileSha256: digest(await readFile(join(root, "pnpm-lock.yaml"))),
    node: { ...config, url: nodeURL, licenseFile: "licenses/Node.js.LICENSE" },
    compiler,
    packages: [...packages.values()].sort((a, b) => a.name.localeCompare(b.name)),
  }
  await writeFile(join(stage, "versions.json"), `${JSON.stringify(metadata, null, 2)}\n`)
  await copyFile(new URL("../distribution/README.md", import.meta.url), join(stage, "README.md"))
  await copyFile(
    new URL("../distribution/README.ja.md", import.meta.url),
    join(stage, "README.ja.md"),
  )
  console.log("Verifying staged distribution...")
  await verifyDistribution(stage)
  const zip = join(work, `${name}.zip`)
  invoke("zip", ["-q", "-r", zip, name], work)
  console.log("Verifying extracted ZIP...")
  const extracted = join(work, "unpacked")
  await mkdir(extracted)
  invoke("unzip", ["-q", zip, "-d", extracted])
  await verifyDistribution(join(extracted, name))
  await cp(stage, folder, { recursive: true, errorOnExist: true, force: false })
  await copyFile(zip, archive)
  await writeFile(`${archive}.sha256`, `${digest(await readFile(archive))}  ${basename(archive)}\n`)
  console.log(`Created: ${folder}\nCreated: ${archive}\nChecksum: ${archive}.sha256`)
} finally {
  await rm(work, { recursive: true, force: true })
}
