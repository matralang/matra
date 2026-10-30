import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { buildProject, initProject } from "../src/project.mjs"

const cli = fileURLToPath(new URL("../src/cli.mjs", import.meta.url))
const css = new URL(import.meta.resolve("@matra/styles/matra.css"))

async function temporary(t) {
  const root = await mkdtemp(join(tmpdir(), "matra-cli-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

function invoke(cwd, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PATH: "" },
  })
  if (result.error) throw result.error
  return result
}

test("CLI initializes and builds an offline page outside the checkout without external tools", async t => {
  const root = await temporary(t)
  const created = invoke(root, "init", "hello world")
  assert.equal(created.status, 0, created.stderr)
  assert.match(created.stdout, /matra build/)
  const project = join(root, "hello world")
  assert.deepEqual((await readdir(project)).sort(), [
    ".gitignore",
    "index.md",
    "matra.css",
    "matra.css.LICENSE",
  ])
  assert.equal(await readFile(join(project, ".gitignore"), "utf8"), "/dist/\n")
  assert.deepEqual(await readFile(join(project, "matra.css")), await readFile(css))
  assert.deepEqual(
    await readFile(join(project, "matra.css.LICENSE")),
    await readFile(new URL("LICENSE", css)),
  )

  const built = invoke(project, "build")
  assert.equal(built.status, 0, built.stderr)
  assert.match(built.stdout, /index\.html/)
  const output = join(project, "dist")
  const html = await readFile(join(output, "index.html"), "utf8")
  assert.ok(html.startsWith("<!doctype html>\n<html"))
  assert.match(html, /<title>Hello, Matra!<\/title>/)
  assert.match(html, /<h1>Hello, Matra!<\/h1>/)
  assert.match(html, /href="\.\/matra\.css"/)
  assert.match(html, /Your first Matra page is ready\./)
  assert.equal((html.match(/<li>/g) ?? []).length, 3)
  assert.doesNotMatch(html, /https?:\/\//)
  assert.deepEqual(await readFile(join(output, "matra.css")), await readFile(css))
  assert.deepEqual(
    await readFile(join(output, "matra.css.LICENSE")),
    await readFile(new URL("LICENSE", css)),
  )

  const source = await readFile(join(project, "index.md"), "utf8")
  await writeFile(join(project, "index.md"), source.replaceAll("Hello, Matra!", "Hello & <World>"))
  await writeFile(join(project, "matra.css"), "body { color: red; }\n")
  assert.equal(invoke(project, "build").status, 0)
  assert.match(await readFile(join(output, "index.html"), "utf8"), /Hello &amp; &lt;World&gt;/)
  assert.equal(await readFile(join(output, "matra.css"), "utf8"), "body { color: red; }\n")
  assert.equal(
    await readFile(join(project, "index.md"), "utf8"),
    source.replaceAll("Hello, Matra!", "Hello & <World>"),
  )
  assert.equal(invoke(project, "build").status, 0)
})

test("init refuses existing files, empty directories, and nonempty directories without changing them", async t => {
  const root = await temporary(t)
  await writeFile(join(root, "file"), "keep")
  await mkdir(join(root, "empty"))
  const project = await initProject(join(root, "project"))
  const before = await readFile(join(project, "index.md"), "utf8")
  for (const name of ["file", "empty", "project"]) {
    const result = invoke(root, "init", name)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /EEXIST/)
  }
  assert.equal(await readFile(join(root, "file"), "utf8"), "keep")
  assert.deepEqual(await readdir(join(root, "empty")), [])
  assert.equal(await readFile(join(project, "index.md"), "utf8"), before)
})

test("CLI reports invalid usage, help, and version without creating files", async t => {
  const root = await temporary(t)
  for (const args of [
    [],
    ["init"],
    ["init", "hello", "extra"],
    ["build", "extra"],
    ["dev"],
    ["unknown"],
  ]) {
    const result = invoke(root, ...args)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Usage: matra/)
  }
  assert.equal(invoke(root, "--help").status, 0)
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
  assert.equal(invoke(root, "--version").stdout.trim(), pkg.version)
  assert.deepEqual(await readdir(root), [])
})

test("build reports missing inputs and configuration errors without success output", async t => {
  const root = await temporary(t)
  const missing = invoke(root, "build")
  assert.equal(missing.status, 1)
  assert.equal(missing.stdout, "")
  assert.match(missing.stderr, /ENOENT.*index\.md/)
  const project = await initProject(join(root, "project"))
  await writeFile(join(project, "index.md"), "No selected entry.\n")
  const invalid = invoke(project, "build")
  assert.equal(invalid.status, 1)
  assert.equal(invalid.stdout, "")
  assert.match(invalid.stderr, /index\.md/)
  assert.ok(!(await readdir(project)).includes("dist"))
  await rm(join(project, "matra.css"))
  await assert.rejects(buildProject(project), /ENOENT.*matra\.css/)
})

test("failed compilation or execution preserves previous output and unrelated files", async t => {
  const root = await temporary(t)
  const project = await initProject(join(root, "project"))
  await buildProject(project)
  const output = join(project, "dist")
  const previous = await readFile(join(output, "index.html"), "utf8")
  await writeFile(join(output, "keep.txt"), "keep")
  const source = await readFile(join(project, "index.md"), "utf8")
  for (const invalid of [
    source.replace('html(lang="en") {', 'html(lang="en") { ]'),
    source.replace(
      '"Your first Matra page is ready."',
      '(() => { throw new Error("template failure") })()',
    ),
  ]) {
    await writeFile(join(project, "index.md"), invalid)
    const result = invoke(project, "build")
    assert.equal(result.status, 1)
    assert.equal(result.stdout, "")
    assert.match(result.stderr, /index\.md/)
    assert.equal(await readFile(join(output, "index.html"), "utf8"), previous)
  }
  await writeFile(join(project, "index.md"), source)
  await buildProject(project)
  assert.equal(await readFile(join(output, "keep.txt"), "utf8"), "keep")
})

test("build refuses a file at dist and does not change it", async t => {
  const root = await temporary(t)
  const project = await initProject(join(root, "project"))
  await writeFile(join(project, "dist"), "keep")
  await assert.rejects(buildProject(project), /Expected an output directory/)
  assert.equal(await readFile(join(project, "dist"), "utf8"), "keep")
})

test("build refuses symlink outputs and init refuses a symlink destination", {
  skip: process.platform === "win32",
}, async t => {
  const root = await temporary(t)
  const project = await initProject(join(root, "project"))
  const outside = join(root, "outside")
  await mkdir(outside)
  await symlink(outside, join(project, "dist"), "dir")
  await assert.rejects(buildProject(project), /Expected an output directory/)
  assert.deepEqual(await readdir(outside), [])
  await assert.rejects(initProject(join(project, "dist")), { code: "EEXIST" })
  await rm(join(project, "dist"))
  await mkdir(join(project, "dist"))
  const protectedFile = join(outside, "keep")
  await writeFile(protectedFile, "keep")
  for (const name of ["index.html", "matra.css", "matra.css.LICENSE"]) {
    const link = join(project, "dist", name)
    await symlink(protectedFile, link)
    await assert.rejects(buildProject(project), /Expected a regular file/)
    assert.equal(await readFile(protectedFile, "utf8"), "keep")
    await rm(link)
  }
})
