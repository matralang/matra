import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { createZip } from "../scripts/distribution-platform.mjs"
import { releaseTag, verifyReleaseAssets } from "../scripts/verify-release.mjs"

const root = fileURLToPath(new URL("../../../", import.meta.url))
const cli = JSON.parse(await readFile(new URL("../package.json", import.meta.url)))
const pins = JSON.parse(await readFile(new URL("../distribution/node.json", import.meta.url)))
const digest = bytes => createHash("sha256").update(bytes).digest("hex")
const commit = "a".repeat(40)

test("release version and tag are distinct from Core", async () => {
  const core = JSON.parse(await readFile(join(root, "packages/core/package.json")))
  assert.equal(releaseTag, `build-tools-v${cli.version}`)
  assert.notEqual(cli.version, core.version)
  assert.match(cli.version, /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/)
})

test("release requires six exact archives, correct hashes, clean and matching provenance", async t => {
  const work = await mkdtemp(join(tmpdir(), "matra-release-test-"))
  t.after(() => rm(work, { recursive: true, force: true }))
  const assets = join(work, "assets")
  await mkdir(assets)
  const packages = []
  for (const workspace of ["cli", "core", "html", "styles"]) {
    const pkg = JSON.parse(await readFile(join(root, "packages", workspace, "package.json")))
    packages.push({ name: pkg.name, version: pkg.version })
  }
  const core = packages.find(pkg => pkg.name === "@matra/core")
  const compilerBytes = Buffer.from("fixture compiler")
  const compiler = {
    version: core.version,
    stage2EqualsStage3: true,
    sha256: digest(compilerBytes),
  }
  const lockfileSha256 = digest(await readFile(join(root, "pnpm-lock.yaml")))
  async function archive(target, changes = {}) {
    const name = `matra-${cli.version}-${target}`
    const folder = join(work, name)
    const compilerDir = join(folder, "app/node_modules/@matra/core/dist/literate")
    await mkdir(compilerDir, { recursive: true })
    await writeFile(join(compilerDir, "compiler.wasm"), compilerBytes)
    await writeFile(join(compilerDir, "compiler.json"), JSON.stringify(compiler))
    await writeFile(
      join(folder, "versions.json"),
      JSON.stringify({
        name,
        target,
        version: cli.version,
        sourceCommit: commit,
        sourceDirty: false,
        lockfileSha256,
        packages,
        compiler,
        node: {
          version: pins.version,
          target,
          ...pins.targets[target],
          url: `https://nodejs.org/dist/v${pins.version}/${pins.targets[target].archive}`,
        },
        ...changes,
      }),
    )
    const zip = join(assets, `${name}.zip`)
    await rm(zip, { force: true })
    createZip(zip, folder, work, name)
    await writeFile(`${zip}.sha256`, `${digest(await readFile(zip))}  ${name}.zip\n`)
    return zip
  }
  for (const target of Object.keys(pins.targets)) await archive(target)
  await verifyReleaseAssets(assets, commit)
  await assert.rejects(verifyReleaseAssets(assets, "b".repeat(40)), /Source commit mismatch/)
  const target = Object.keys(pins.targets)[0]
  await archive(target, { sourceDirty: true })
  await assert.rejects(verifyReleaseAssets(assets, commit), /Dirty source/)
  await archive(target, { lockfileSha256: "wrong" })
  await assert.rejects(verifyReleaseAssets(assets, commit))
  const zip = await archive(target)
  await writeFile(`${zip}.sha256`, "wrong\n")
  await assert.rejects(verifyReleaseAssets(assets, commit), /Checksum mismatch/)
  await archive(target)
  await writeFile(join(assets, "unexpected.txt"), "extra")
  await assert.rejects(verifyReleaseAssets(assets, commit), /Expected exactly six ZIPs/)
  await rm(join(assets, "unexpected.txt"))
  await rm(zip)
  await assert.rejects(verifyReleaseAssets(assets, commit), /Expected exactly six ZIPs/)
})

test("release preflight rejects absent or mismatched tags and dirty source", async t => {
  const work = await mkdtemp(join(tmpdir(), "matra-tag-test-"))
  t.after(() => rm(work, { recursive: true, force: true }))
  const git = args => execFileSync("git", args, { cwd: work, stdio: "pipe" })
  git(["init"])
  const env = {
    ...process.env,
    GIT_DIR: join(work, ".git"),
    GIT_WORK_TREE: work,
  }
  const check = () =>
    spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../scripts/verify-release.mjs", import.meta.url)), "--check-tag"],
      { env, encoding: "utf8" },
    )
  const commit = () =>
    git([
      "-c",
      "user.name=Matra test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "test: release fixture\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>",
    ])
  commit()
  assert.notEqual(check().status, 0)
  git(["tag", releaseTag])
  assert.equal(check().status, 0)
  await writeFile(join(work, "untracked.txt"), "dirty")
  const dirty = check()
  assert.notEqual(dirty.status, 0)
  assert.match(dirty.stderr, /Release requires a clean checkout/)
  await rm(join(work, "untracked.txt"))
  commit()
  const mismatch = check()
  assert.notEqual(mismatch.status, 0)
  assert.match(mismatch.stderr, /Release tag must already exist/)
})
