import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const manager = process.env.npm_execpath
if (!manager) throw new Error("Run this verification with pnpm run test:literate:package")
const root = await mkdtemp(join(tmpdir(), "matra-packed-"))
const [managerCommand, ...managerArgs] = /\.(?:c|m)?js$/i.test(manager)
  ? [process.execPath, manager]
  : [manager]
const core = fileURLToPath(new URL("..", import.meta.url))
const html = fileURLToPath(new URL("../../html/", import.meta.url))
const cliPackage = fileURLToPath(new URL("../../cli/", import.meta.url))
const styles = fileURLToPath(new URL("../../styles/", import.meta.url))
const invoke = (cwd, ...args) =>
  execFileSync(managerCommand, [...managerArgs, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

try {
  invoke(core, "pack", "--out", join(root, "core.tgz"))
  invoke(html, "pack", "--out", join(root, "html.tgz"))
  invoke(cliPackage, "pack", "--out", join(root, "cli.tgz"))
  invoke(styles, "pack", "--out", join(root, "styles.tgz"))
  await writeFile(join(root, "package.json"), '{"private":true,"type":"module"}\n')
  await writeFile(
    join(root, "pnpm-workspace.yaml"),
    "overrides:\n" +
      "  '@matra/core': file:./core.tgz\n" +
      "  '@matra/html': file:./html.tgz\n" +
      "  '@matra/styles': file:./styles.tgz\n",
  )
  invoke(root, "add", "--ignore-scripts", "./core.tgz", "./html.tgz", "./cli.tgz", "./styles.tgz")
  const corePackage = JSON.parse(await readFile(join(core, "package.json"), "utf8"))
  const htmlPackage = JSON.parse(await readFile(join(html, "package.json"), "utf8"))
  const installedCore = JSON.parse(
    await readFile(join(root, "node_modules/@matra/core/package.json"), "utf8"),
  )
  const installedHtml = JSON.parse(
    await readFile(join(root, "node_modules/@matra/html/package.json"), "utf8"),
  )
  assert.equal(installedCore.version, corePackage.version)
  assert.equal(installedHtml.version, htmlPackage.version)
  assert.equal(installedHtml.peerDependencies["@matra/core"], `^${corePackage.version}`)
  assert.equal(installedCore.exports["./browser"].import, "./dist/browser.js")
  assert.equal(installedCore.exports["./browser"].types, "./dist/browser.d.ts")
  const markdown = await readFile(
    new URL("../../html/examples/web-page.md", import.meta.url),
    "utf8",
  )
  await writeFile(join(root, "web-page.md"), markdown)
  const script = `
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import {
  evaluate,
  parse,
  staticValueToAST as staticValueToBrowserAST,
} from "@matra/core/browser"
import { staticValueToAST } from "@matra/core"
import { buildLiterate, runLiterate, LiterateError } from "@matra/core/experimental/literate"
import { toHTML } from "@matra/html"
assert.deepEqual(
  staticValueToBrowserAST(evaluate(parse('article { h1 { "Browser entry" } }'))),
  { tag: "article", props: {}, children: [{ tag: "h1", props: {}, children: ["Browser entry"] }] },
)
await assert.rejects(import("@matra/core/literate"), {
  code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
})
try {
  const bundle = await buildLiterate(await readFile("web-page.md", "utf8"))
  const html = toHTML(staticValueToAST(await runLiterate(bundle)))
  assert.match(html, /すべて読む目安：24分/)
  assert.match(html, /Matra &amp; Web/)
  assert.equal((html.match(/<li>/g) ?? []).length, 3)
} catch (error) {
  if (process.env.EXPECT_COMPILER_ERROR === "1") {
    assert.ok(error instanceof LiterateError)
    assert.equal(error.code, "COMPILER_LOAD")
    process.exit(0)
  }
  throw error
}
assert.notEqual(process.env.EXPECT_COMPILER_ERROR, "1")
`
  await writeFile(join(root, "verify.mjs"), script)
  const execute = (args, env = {}) =>
    execFileSync(process.execPath, args, {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: "", MATRA_BOOTSTRAP_CACHE_DIR: join(root, "absent"), ...env },
    })
  assert.equal(execute(["verify.mjs"]), "")
  const projectCLI = join(root, "node_modules/@matra/cli/src/cli.mjs")
  execute([projectCLI, "init", "hello"])
  assert.match(invoke(root, "exec", "matra", "--help"), /Usage: matra/)
  const project = join(root, "hello")
  execFileSync(process.execPath, [projectCLI, "build"], {
    cwd: project,
    encoding: "utf8",
    env: { ...process.env, PATH: "", MATRA_BOOTSTRAP_CACHE_DIR: join(root, "absent") },
  })
  assert.match(await readFile(join(project, "dist/index.html"), "utf8"), /Hello, Matra!/)
  assert.equal(
    await readFile(join(project, "dist/matra.css"), "utf8"),
    await readFile(join(root, "node_modules/@matra/styles/matra.css"), "utf8"),
  )
  assert.equal(
    await readFile(join(project, "dist/matra.css.LICENSE"), "utf8"),
    await readFile(join(root, "node_modules/@matra/styles/LICENSE"), "utf8"),
  )
  execute([
    "--input-type=module",
    "-e",
    `
import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { setTimeout as delay } from "node:timers/promises"
import { startDev } from "./node_modules/@matra/cli/src/dev.mjs"
const errors = []
const dev = await startDev("hello", {
  port: 0,
  onBuild: () => {},
  onError: message => errors.push(message),
})
try {
  const page = await fetch(dev.url)
  assert.equal(page.status, 200)
  assert.match(await page.text(), /Hello, Matra!/)
  await writeFile("hello/matra.css", "body { color: red; }")
  const deadline = Date.now() + 10000
  let updated = false
  while (Date.now() < deadline) {
    if (await (await fetch(dev.url + "matra.css")).text() === "body { color: red; }") {
      updated = true
      break
    }
    await delay(50)
  }
  assert.ok(updated, "Packed dev server must rebuild after a CSS change")
  assert.deepEqual(errors, [])
} finally {
  await dev.close()
}
`,
  ])
  const cli = join(root, "node_modules/@matra/core/dist/literate/cli.mjs")
  assert.equal(execute([cli, "build", root, "web-page.md", "bundle.json"]), "")
  assert.equal(
    invoke(root, "exec", "matra-literate", "build", root, "web-page.md", "bundle.json"),
    "",
  )
  assert.equal(
    JSON.parse(invoke(root, "exec", "matra-literate", "run", root, "bundle.json")).tag,
    "html",
  )
  const value = JSON.parse(execute([cli, "run", root, "bundle.json"]))
  assert.equal(value.tag, "html")
  const compiler = join(root, "node_modules/@matra/core/dist/literate/compiler.wasm")
  const bytes = await readFile(compiler)
  await rm(compiler)
  assert.equal(
    execute([
      "--input-type=module",
      "-e",
      'import { parse } from "@matra/core"; if (!parse) process.exit(1)',
    ]),
    "",
  )
  execute(["verify.mjs"], { EXPECT_COMPILER_ERROR: "1" })
  await writeFile(compiler, Buffer.from("corrupt"))
  execute(["verify.mjs"], { EXPECT_COMPILER_ERROR: "1" })
  await writeFile(compiler, bytes)
  assert.equal(execute(["verify.mjs"]), "")
  const manifestPath = join(root, "node_modules/@matra/core/dist/literate/compiler.json")
  const manifest = await readFile(manifestPath, "utf8")
  assert.equal(JSON.parse(manifest).version, corePackage.version)
  await rm(manifestPath)
  await writeFile(manifestPath, JSON.stringify({ ...JSON.parse(manifest), abi: "unknown" }))
  execute(["verify.mjs"], { EXPECT_COMPILER_ERROR: "1" })
  await writeFile(manifestPath, manifest)
  await writeFile(
    join(root, "types.mts"),
    `
import { buildLiterate, runLiterate, LiterateError } from "@matra/core/experimental/literate"
import type { LiterateBundle, LiterateBuildOptions } from "@matra/core/experimental/literate"
import { evaluate, parse, staticValueToAST } from "@matra/core/browser"
const options: LiterateBuildOptions = { document: "example.md" }
const bundle: LiterateBundle = await buildLiterate("", options)
await runLiterate(bundle)
const inspect = (error: LiterateError): string => error.code + error.document + error.path + error.line
void inspect
const browserValue = evaluate(parse('p { "Browser" }'))
if (browserValue !== undefined) void staticValueToAST(browserValue)
`,
  )
  execFileSync(
    process.execPath,
    [
      join(core, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--module",
      "NodeNext",
      "--target",
      "ES2022",
      join(root, "types.mts"),
    ],
    { cwd: root, encoding: "utf8" },
  )
  console.log(
    "Packed Core/HTML/CLI/Styles: APIs, types, init/build/dev, missing/corrupt compiler, and Rust-free execution passed.",
  )
} finally {
  await rm(root, { recursive: true, force: true })
}
