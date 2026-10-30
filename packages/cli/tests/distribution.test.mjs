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
  if (`${process.platform}-${process.arch}` !== config.target) {
    t.skip(`Native builder currently supports ${config.target} only`)
    return
  }
  const root = await temporary(t)
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url)))
  const filename = `matra-${pkg.version}-${config.target}.zip`
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
