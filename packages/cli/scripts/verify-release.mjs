import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { extractZip } from "./distribution-platform.mjs"

const root = fileURLToPath(new URL("../../../", import.meta.url))
const cli = JSON.parse(await readFile(new URL("../package.json", import.meta.url)))
const pins = JSON.parse(await readFile(new URL("../distribution/node.json", import.meta.url)))
export const releaseTag = `build-tools-v${cli.version}`
const digest = bytes => createHash("sha256").update(bytes).digest("hex")

export function verifyReleaseTag() {
  assert.match(cli.version, /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/, "Expected a prerelease version")
  const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  assert.equal(
    git(["rev-parse", `${releaseTag}^{commit}`]),
    git(["rev-parse", "HEAD"]),
    "Release tag must already exist and point at the checked-out commit",
  )
  assert.equal(git(["status", "--porcelain"]), "", "Release requires a clean checkout")
}

export async function verifyReleaseAssets(directory, commit) {
  assert.match(commit, /^[a-f0-9]{40}$/, "Expected a full source commit SHA")
  const targets = Object.keys(pins.targets).sort()
  const expectedFiles = targets
    .flatMap(target => {
      const zip = `matra-${cli.version}-${target}.zip`
      return [zip, `${zip}.sha256`]
    })
    .sort()
  assert.deepEqual(
    (await readdir(directory)).sort(),
    expectedFiles,
    "Expected exactly six ZIPs and six checksum files",
  )
  const lockfileSha256 = digest(await readFile(join(root, "pnpm-lock.yaml")))
  const versions = new Map()
  for (const workspace of ["cli", "core", "html", "styles"]) {
    const pkg = JSON.parse(await readFile(join(root, "packages", workspace, "package.json")))
    versions.set(pkg.name, pkg.version)
  }
  const work = await mkdtemp(join(tmpdir(), "matra-release-"))
  let compilerManifest
  try {
    for (const target of targets) {
      const name = `matra-${cli.version}-${target}`
      const filename = `${name}.zip`
      const zip = join(directory, filename)
      assert.equal(
        await readFile(`${zip}.sha256`, "utf8"),
        `${digest(await readFile(zip))}  ${filename}\n`,
        `Checksum mismatch: ${target}`,
      )
      const unpacked = join(work, target)
      await mkdir(unpacked)
      extractZip(zip, unpacked)
      assert.deepEqual(await readdir(unpacked), [name])
      const home = join(unpacked, name)
      const metadata = JSON.parse(await readFile(join(home, "versions.json")))
      assert.equal(metadata.name, name)
      assert.equal(metadata.version, cli.version)
      assert.equal(metadata.target, target)
      assert.equal(metadata.sourceCommit, commit, `Source commit mismatch: ${target}`)
      assert.equal(metadata.sourceDirty, false, `Dirty source: ${target}`)
      assert.equal(metadata.lockfileSha256, lockfileSha256)
      assert.equal(metadata.node.version, pins.version)
      assert.equal(metadata.node.target, target)
      assert.equal(metadata.node.archive, pins.targets[target].archive)
      assert.equal(metadata.node.sha256, pins.targets[target].sha256)
      assert.equal(
        metadata.node.url,
        `https://nodejs.org/dist/v${pins.version}/${pins.targets[target].archive}`,
      )
      for (const [name, version] of versions) {
        assert.equal(metadata.packages.find(pkg => pkg.name === name)?.version, version)
      }
      const compilerDirectory = join(home, "app/node_modules/@matra/core/dist/literate")
      const manifest = JSON.parse(await readFile(join(compilerDirectory, "compiler.json")))
      assert.deepEqual(manifest, metadata.compiler)
      if (compilerManifest)
        assert.deepEqual(manifest, compilerManifest, "Compiler must match across targets")
      compilerManifest = manifest
      assert.equal(manifest.version, versions.get("@matra/core"))
      assert.equal(manifest.stage2EqualsStage3, true)
      assert.equal(
        digest(await readFile(join(compilerDirectory, "compiler.wasm"))),
        manifest.sha256,
      )
    }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === "--check-tag") {
    verifyReleaseTag()
    console.log(`Verified release tag: ${releaseTag}`)
  } else if (args.length === 2) {
    verifyReleaseTag()
    assert.equal(
      args[1],
      execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      "Expected the checked-out source commit",
    )
    await verifyReleaseAssets(resolve(args[0]), args[1])
    console.log(`Verified all six release archives: ${releaseTag}`)
  } else {
    throw new Error("Usage: verify-release.mjs --check-tag | DIRECTORY COMMIT")
  }
}
