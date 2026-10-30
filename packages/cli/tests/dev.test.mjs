import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { startDev } from "../src/dev.mjs"
import { initProject } from "../src/project.mjs"

async function project(t) {
  const root = await mkdtemp(join(tmpdir(), "matra-dev-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  return initProject(join(root, "hello"))
}

async function waitFor(check) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    if (await check()) return
    await delay(50)
  }
  assert.fail("Timed out waiting for dev server")
}

async function preview(t, root) {
  const builds = []
  const errors = []
  const dev = await startDev(root, {
    port: 0,
    onBuild: message => builds.push(message),
    onError: message => errors.push(message),
  })
  t.after(() => dev.close())
  return { ...dev, builds, errors }
}

test("dev serves only generated assets with correct methods, MIME types, and no caching", async t => {
  const root = await project(t)
  await writeFile(join(root, "secret.txt"), "not public")
  const dev = await preview(t, root)
  const html = await fetch(dev.url)
  assert.equal(html.status, 200)
  assert.equal(html.headers.get("content-type"), "text/html; charset=utf-8")
  assert.equal(html.headers.get("cache-control"), "no-store")
  assert.equal(await html.text(), await readFile(join(root, "dist/index.html"), "utf8"))
  for (const [file, type] of [
    ["index.html", "text/html"],
    ["matra.css", "text/css"],
    ["matra.css.LICENSE", "text/plain"],
  ]) {
    const response = await fetch(`${dev.url}${file}?v=1`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get("content-type"), new RegExp(type))
    assert.equal(await response.text(), await readFile(join(root, "dist", file), "utf8"))
  }
  const head = await fetch(dev.url, { method: "HEAD" })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), "")
  const post = await fetch(dev.url, { method: "POST" })
  assert.equal(post.status, 405)
  assert.equal(post.headers.get("allow"), "GET, HEAD")
  for (const path of [
    "index.md",
    "secret.txt",
    "%2e%2e%2fsecret.txt",
    "dist/index.html",
    "missing",
  ]) {
    const response = await fetch(`${dev.url}${path}`)
    assert.equal(response.status, 404)
    assert.equal(await response.text(), "Not found\n")
  }
  assert.equal(dev.builds.length, 1)
  assert.deepEqual(dev.errors, [])
})

test("dev watches content, atomic saves, CSS, and license, and recovers after deletion and errors", async t => {
  const root = await project(t)
  const dev = await preview(t, root)
  const source = await readFile(join(root, "index.md"), "utf8")
  await writeFile(join(root, "replacement.md"), source.replaceAll("Hello, Matra!", "Updated title"))
  await rename(join(root, "replacement.md"), join(root, "index.md"))
  await waitFor(async () => (await (await fetch(dev.url)).text()).includes("Updated title"))

  await writeFile(join(root, "matra.css"), "body { color: red; }\n")
  await waitFor(
    async () => (await (await fetch(`${dev.url}matra.css`)).text()) === "body { color: red; }\n",
  )
  await writeFile(join(root, "matra.css.LICENSE"), "Updated license\n")
  await waitFor(
    async () => (await (await fetch(`${dev.url}matra.css.LICENSE`)).text()) === "Updated license\n",
  )

  for (const broken of [
    "Missing configuration\n",
    source.replace('html(lang="en") {', 'html(lang="en") { ]'),
    source.replace('"Your first Matra page is ready."', '(() => { throw new Error("failed") })()'),
  ]) {
    const count = dev.errors.length
    await writeFile(join(root, "index.md"), broken)
    await waitFor(() => dev.errors.length > count)
    const response = await fetch(dev.url)
    assert.equal(response.status, 503)
    assert.match(response.headers.get("content-type"), /text\/plain/)
    assert.match(await response.text(), /Build failed:.*index\.md/)
    await writeFile(join(root, "index.md"), source)
    await waitFor(async () => (await fetch(dev.url)).status === 200)
  }

  const count = dev.errors.length
  await rm(join(root, "matra.css"))
  await waitFor(() => dev.errors.length > count)
  assert.match(dev.errors.at(-1), /ENOENT.*matra\.css/)
  assert.equal((await fetch(dev.url)).status, 503)
  await writeFile(join(root, "matra.css"), "body { color: blue; }\n")
  await waitFor(async () => (await fetch(dev.url)).status === 200)
  assert.equal(await (await fetch(`${dev.url}matra.css`)).text(), "body { color: blue; }\n")

  for (let index = 0; index < 12; index++) {
    await writeFile(join(root, "index.md"), source.replaceAll("Hello, Matra!", `Title ${index}`))
  }
  await waitFor(async () => (await (await fetch(dev.url)).text()).includes("Title 11"))
  await dev.close()
  const builds = dev.builds.length
  await writeFile(join(root, "index.md"), source)
  await delay(400)
  assert.equal(dev.builds.length, builds)
  await assert.rejects(fetch(dev.url))
})

test("dev does not rebuild when only output files change", async t => {
  const root = await project(t)
  const dev = await preview(t, root)
  const builds = dev.builds.length
  await writeFile(join(root, "dist/ignored.txt"), "not an input")
  await delay(600)
  assert.equal(dev.builds.length, builds)
  assert.deepEqual(dev.errors, [])
})

test("startup reports missing inputs and an occupied port and releases resources", async t => {
  const root = await project(t)
  await assert.rejects(startDev(join(root, "missing"), { port: 0 }), /ENOENT/)
  const blocker = createServer()
  blocker.listen(0, "127.0.0.1")
  await once(blocker, "listening")
  t.after(() => new Promise(resolve => blocker.close(resolve)))
  await assert.rejects(startDev(root, { port: blocker.address().port, onBuild: () => {} }), {
    code: "EADDRINUSE",
  })
})

test("CLI starts without external tools and exits cleanly on SIGTERM", {
  skip: process.platform === "win32",
}, async t => {
  const root = await project(t)
  const cli = fileURLToPath(new URL("../src/cli.mjs", import.meta.url))
  const reservation = createServer()
  reservation.listen(0, "127.0.0.1")
  await once(reservation, "listening")
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  const child = spawn(process.execPath, [cli, "dev", "--port", String(port)], {
    cwd: root,
    env: { ...process.env, PATH: "" },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let stdout = ""
  let stderr = ""
  child.stdout.on("data", bytes => {
    stdout += bytes
  })
  child.stderr.on("data", bytes => {
    stderr += bytes
  })
  const exited = once(child, "exit")
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM")
    await exited
  })
  await waitFor(() => {
    assert.equal(child.exitCode, null, stderr)
    return stdout.includes("Serving:")
  })
  const url = stdout.match(/Serving: (http:\/\/[^\s]+)/)[1]
  assert.equal((await fetch(url)).status, 200)
  child.kill("SIGTERM")
  const [code, signal] = await exited
  assert.equal(code, 0)
  assert.equal(signal, null)
  assert.equal(stderr, "")
  await assert.rejects(fetch(url))
})
