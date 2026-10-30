import assert from "node:assert/strict"
import { execFileSync, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { once } from "node:events"
import { cp, lstat, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { fileURLToPath } from "node:url"

export async function verifyDistribution(directory) {
  const original = resolve(directory)
  const metadata = JSON.parse(await readFile(join(original, "versions.json")))
  if (`${process.platform}-${process.arch}` !== metadata.target) {
    throw new Error(`Cannot execute ${metadata.target} on this host`)
  }
  const root = await mkdtemp(join(tmpdir(), "matra-distribution-"))
  try {
    const home = join(root, "日本語 path with spaces", metadata.name)
    await cp(original, home, { recursive: true })
    async function checkFiles(path) {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        const child = join(path, entry.name)
        assert.ok(!entry.isSymbolicLink(), `Distribution must be self-contained: ${child}`)
        if (entry.isDirectory()) await checkFiles(child)
      }
    }
    await checkFiles(home)
    const env = {
      ...process.env,
      PATH: "",
      NODE_OPTIONS: "",
      NODE_PATH: "",
      MATRA_BOOTSTRAP_CACHE_DIR: join(root, "absent"),
    }
    const node = join(home, "runtime/bin/node")
    const launcher = join(home, "matra")
    const run = (command, args, cwd = root) =>
      execFileSync(command, args, { cwd, env, encoding: "utf8", timeout: 30000 })
    assert.equal(run(node, ["--version"]).trim(), `v${metadata.node.version}`)
    assert.equal(run(launcher, ["--version"]).trim(), metadata.version)
    assert.match(run(launcher, ["--help"]), /matra dev/)
    for (const path of ["LICENSE", "README.md", "README.ja.md", metadata.node.licenseFile]) {
      assert.ok((await readFile(join(home, path))).length > 0)
    }
    for (const entry of metadata.packages) {
      const pkg = JSON.parse(
        await readFile(join(home, "app/node_modules", entry.name, "package.json")),
      )
      assert.equal(pkg.version, entry.version)
      assert.ok((await readFile(join(home, entry.licenseFile))).length > 0)
      for (const dependency of Object.keys(pkg.dependencies ?? {})) {
        assert.ok(
          metadata.packages.some(item => item.name === dependency),
          dependency,
        )
      }
    }
    const compilerPath = join(home, "app/node_modules/@matra/core/dist/literate")
    const compiler = JSON.parse(await readFile(join(compilerPath, "compiler.json")))
    assert.deepEqual(compiler, metadata.compiler)
    assert.equal(
      createHash("sha256")
        .update(await readFile(join(compilerPath, "compiler.wasm")))
        .digest("hex"),
      compiler.sha256,
    )
    run(launcher, ["init", "hello world"])
    const project = join(root, "hello world")
    run(launcher, ["build"], project)
    assert.match(await readFile(join(project, "dist/index.html"), "utf8"), /Hello, Matra!/)
    assert.deepEqual(
      await readFile(join(project, "dist/matra.css")),
      await readFile(join(home, "app/node_modules/@matra/styles/matra.css")),
    )
    assert.deepEqual(
      await readFile(join(project, "dist/matra.css.LICENSE")),
      await readFile(join(home, "app/node_modules/@matra/styles/LICENSE")),
    )

    const reservation = createServer()
    reservation.listen(0, "127.0.0.1")
    await once(reservation, "listening")
    const port = reservation.address().port
    await new Promise(resolve => reservation.close(resolve))
    const dev = spawn(launcher, ["dev", "--port", String(port)], {
      cwd: project,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    dev.stdout.on("data", bytes => {
      stdout += bytes
    })
    dev.stderr.on("data", bytes => {
      stderr += bytes
    })
    const exited = once(dev, "exit")
    async function waitFor(check) {
      const deadline = Date.now() + 10000
      while (Date.now() < deadline) {
        assert.equal(dev.exitCode, null, stderr)
        if (await check()) return
        await delay(50)
      }
      assert.fail(`Timed out waiting for bundled dev server: ${stdout}\n${stderr}`)
    }
    try {
      await waitFor(() => stdout.includes("Serving:"))
      const url = stdout.match(/Serving: (http:\/\/[^\s]+)/)[1]
      const page = await fetch(url)
      assert.equal(page.status, 200)
      assert.match(await page.text(), /Hello, Matra!/)
      await writeFile(join(project, "matra.css"), "body { color: red; }\n")
      await waitFor(
        async () => (await (await fetch(`${url}matra.css`)).text()) === "body { color: red; }\n",
      )
    } finally {
      dev.kill("SIGTERM")
      const timer = setTimeout(() => dev.kill("SIGKILL"), 5000)
      try {
        const [code, signal] = await exited
        assert.equal(code, 0, stderr)
        assert.equal(signal, null)
      } finally {
        clearTimeout(timer)
      }
    }
    assert.equal(stderr, "")
    console.log(
      "Distribution verified: relocated paths, licenses, compiler, init/build/dev, empty PATH.",
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args[0] === "--") args.shift()
  if (args.length !== 1) throw new Error("Usage: pnpm distribution:verify DIRECTORY")
  if (!(await lstat(args[0])).isDirectory())
    throw new Error("Expected an extracted distribution folder")
  await verifyDistribution(args[0])
}
