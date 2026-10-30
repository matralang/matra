import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { createZip, extractZip, runLauncher } from "../scripts/distribution-platform.mjs"
import { verifyDistribution } from "../scripts/verify-distribution.mjs"

async function temporary(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "matra-distribution-test-")))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test("POSIX launcher uses its own runtime, preserves arguments and working directory", {
  skip: process.platform === "win32",
}, async t => {
  const root = await temporary(t)
  const home = join(root, "日本語 with spaces")
  await mkdir(join(home, "runtime/bin"), { recursive: true })
  const launcher = join(home, "matra")
  await copyFile(new URL("../distribution/matra", import.meta.url), launcher)
  await chmod(launcher, 0o755)
  await writeFile(join(home, "runtime/bin/node"), '#!/bin/sh\nprintf "%s\\n" "$PWD" "$@"\n', {
    mode: 0o755,
  })
  const args = ["init", "hello world", "quotes\"and'characters", "--port", "3001"]
  const expected = [root, join(home, "app/node_modules/@matra/cli/src/cli.mjs"), ...args, ""].join(
    "\n",
  )
  assert.equal(
    execFileSync(launcher, args, {
      cwd: root,
      env: { PATH: "" },
      encoding: "utf8",
    }),
    expected,
  )
  assert.equal(
    execFileSync("/bin/sh", ["-c", 'exec matra "$@"', "sh", ...args], {
      cwd: root,
      env: { PATH: home },
      encoding: "utf8",
    }),
    expected,
  )
})

test("distribution verification refuses the wrong host before running binaries", async t => {
  const root = await temporary(t)
  await writeFile(join(root, "versions.json"), JSON.stringify({ target: "unsupported-platform" }))
  await assert.rejects(verifyDistribution(root), /Cannot execute unsupported-platform/)
})

test("ZIP round trips preserve dotfiles, Unicode paths, and executable files", async t => {
  const root = await temporary(t)
  const name = "test archive"
  const folder = join(root, name)
  await mkdir(join(folder, "日本語"), { recursive: true })
  await writeFile(join(folder, ".gitignore"), "/dist/\n")
  await writeFile(join(folder, "日本語", "text.txt"), "preserved\n")
  await writeFile(join(folder, "executable"), "#!/bin/sh\nexit 0\n", { mode: 0o755 })
  const archive = join(root, "test.zip")
  createZip(archive, folder, root, name)
  const zip = await readFile(archive)
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  assert.ok(end >= 0, "Expected ZIP end-of-central-directory record")
  let offset = zip.readUInt32LE(end + 16)
  for (let entry = 0; entry < zip.readUInt16LE(end + 10); entry++) {
    assert.equal(zip.readUInt32LE(offset), 0x02014b50)
    const length = zip.readUInt16LE(offset + 28)
    const filename = zip.subarray(offset + 46, offset + 46 + length).toString("utf8")
    assert.ok(!filename.includes("\\"), `ZIP entry must use forward slashes: ${filename}`)
    offset += 46 + length + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32)
  }
  const destination = join(root, "extracted")
  await mkdir(destination)
  extractZip(archive, destination)
  assert.equal(await readFile(join(destination, name, ".gitignore"), "utf8"), "/dist/\n")
  assert.equal(await readFile(join(destination, name, "日本語/text.txt"), "utf8"), "preserved\n")
  if (process.platform !== "win32") {
    assert.equal(execFileSync(join(destination, name, "executable")).length, 0)
  }
})

test("Windows launcher uses bundled Node.js, preserves cwd and arguments, and propagates errors", {
  skip: process.platform !== "win32",
}, async t => {
  const root = await temporary(t)
  const home = join(root, "日本語 with spaces")
  await mkdir(join(home, "runtime"), { recursive: true })
  await mkdir(join(home, "app/node_modules/@matra/cli/src"), { recursive: true })
  await copyFile(process.execPath, join(home, "runtime/node.exe"))
  await copyFile(new URL("../distribution/matra.cmd", import.meta.url), join(home, "matra.cmd"))
  await writeFile(
    join(home, "app/node_modules/@matra/cli/src/cli.mjs"),
    "console.log(JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) })); process.exitCode = Number(process.argv[2])\n",
  )
  const args = ["0", "hello world", "日本語"]
  const options = { cwd: root, env: { ...process.env, PATH: "" }, encoding: "utf8" }
  const result = JSON.parse(runLauncher(home, args, options))
  assert.equal(result.cwd, root)
  assert.deepEqual(result.args, args)
  assert.throws(() => runLauncher(home, ["7"], options), { status: 7 })
})

test("Node.js pins cover the six native CI targets with SHA-256 digests", async () => {
  const config = JSON.parse(await readFile(new URL("../distribution/node.json", import.meta.url)))
  assert.deepEqual(Object.keys(config.targets).sort(), [
    "darwin-arm64",
    "darwin-x64",
    "linux-arm64",
    "linux-x64",
    "win32-arm64",
    "win32-x64",
  ])
  for (const [target, entry] of Object.entries(config.targets)) {
    assert.match(entry.sha256, /^[a-f0-9]{64}$/)
    const nodeTarget = target.replace("win32-", "win-")
    assert.equal(
      entry.archive,
      `node-v${config.version}-${nodeTarget}.${target.startsWith("win32") ? "zip" : "tar.gz"}`,
    )
  }
})

test("CLI shebangs stay LF with Windows checkout conversion enabled", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url))
  const paths = ["packages/cli/src/cli.mjs", "packages/core/src/literate/cli.mjs"]
  const attributes = execFileSync(
    "git",
    ["-c", "core.autocrlf=true", "check-attr", "eol", "--", ...paths],
    { cwd: root, encoding: "utf8" },
  )
  for (const path of paths) {
    assert.ok(attributes.includes(`${path}: eol: lf`), attributes)
    const content = execFileSync(
      "git",
      ["-c", "core.autocrlf=true", "cat-file", "--filters", `HEAD:${path}`],
      { cwd: root },
    )
    assert.ok(content.subarray(0, content.indexOf(10)).equals(Buffer.from("#!/usr/bin/env node")))
  }
})

test("distribution verification refuses symlinks instead of depending on the checkout", {
  skip: process.platform === "win32",
}, async t => {
  const root = await temporary(t)
  await writeFile(
    join(root, "versions.json"),
    JSON.stringify({
      target: `${process.platform}-${process.arch}`,
      name: "test",
    }),
  )
  await symlink(
    fileURLToPath(new URL("../src", import.meta.url)),
    join(root, "linked-source"),
    "dir",
  )
  await assert.rejects(verifyDistribution(root), /Distribution must be self-contained/)
})

test("distribution build refuses existing artifacts without overwriting them", async t => {
  const config = JSON.parse(await readFile(new URL("../distribution/node.json", import.meta.url)))
  const target = `${process.platform}-${process.arch}`
  if (!Object.hasOwn(config.targets, target)) {
    t.skip(`Unsupported native target: ${target}`)
    return
  }
  const root = await temporary(t)
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url)))
  const filename = `matra-${pkg.version}-${target}.zip`
  await writeFile(join(root, filename), "keep")
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("../scripts/build-distribution.mjs", import.meta.url)),
      "--output",
      root,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, npm_execpath: process.env.npm_execpath ?? process.execPath },
    },
  )
  if (result.error) throw result.error
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Refusing to overwrite/)
  assert.equal(await readFile(join(root, filename), "utf8"), "keep")
  assert.deepEqual(await readdir(root), [filename])
})
