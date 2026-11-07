import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runLauncher } from "./distribution-platform.mjs"

const [cliArchive, stylesArchive] = process.argv.slice(2).map(path => resolve(path))
if (!cliArchive || !stylesArchive || !process.env.npm_execpath) {
  throw new Error("Run via npm with CLI and Styles tarball paths")
}
const npm = process.env.npm_execpath
const work = await mkdtemp(join(tmpdir(), "matra-npm-"))
const prefix = join(work, "prefix")

function run(command, args, cwd = work) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${command}: ${result.stderr}`)
  return result.stdout
}

function launch(args, cwd = work) {
  const home = process.platform === "win32" ? prefix : join(prefix, "bin")
  return runLauncher(home, args, { cwd, env: process.env, encoding: "utf8" })
}

try {
  run(process.execPath, [
    npm,
    "install",
    "--global",
    "--prefix",
    prefix,
    "--no-audit",
    "--no-fund",
    cliArchive,
    stylesArchive,
  ])
  const cli = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
  assert.equal(launch(["--version"]).trim(), cli.version)
  launch(["init", "hello"])
  const project = join(work, "hello")
  launch(["build"], project)
  assert.match(await readFile(join(project, "dist/index.html"), "utf8"), /Hello, Matra!/)
  assert.ok((await readFile(join(project, "dist/matra.css"))).length > 0)
  assert.ok((await readFile(join(project, "dist/matra.css.LICENSE"))).length > 0)

  const listener = createServer()
  listener.listen(0, "127.0.0.1")
  await once(listener, "listening")
  const port = listener.address().port
  await new Promise((resolve, reject) =>
    listener.close(error => (error ? reject(error) : resolve())),
  )
  const modules = join(prefix, process.platform === "win32" ? "node_modules" : "lib/node_modules")
  const child = spawn(
    process.execPath,
    [join(modules, "@matra/cli/src/cli.mjs"), "dev", "--port", String(port)],
    { cwd: project, stdio: ["ignore", "pipe", "pipe"] },
  )
  let output = ""
  child.stdout.on("data", chunk => {
    output += chunk
  })
  child.stderr.on("data", chunk => {
    output += chunk
  })
  try {
    const deadline = Date.now() + 15000
    let response
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`dev exited early: ${output}`)
      if (output.includes("Serving:")) {
        response = await fetch(`http://127.0.0.1:${port}/`)
        break
      }
      await new Promise(done => setTimeout(done, 100))
    }
    assert.ok(response, `dev did not start: ${output}`)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /Hello, Matra!/)
  } finally {
    if (child.exitCode === null) {
      child.kill()
      await once(child, "exit")
    }
  }
  console.log("Packed npm CLI passed version, init, build, and dev checks.")
} finally {
  await rm(work, { recursive: true, force: true })
}
