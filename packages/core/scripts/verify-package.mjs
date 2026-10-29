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
const invoke = (cwd, ...args) =>
  execFileSync(managerCommand, [...managerArgs, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

try {
  invoke(core, "pack", "--out", join(root, "core.tgz"))
  invoke(html, "pack", "--out", join(root, "html.tgz"))
  await writeFile(join(root, "package.json"), '{"private":true,"type":"module"}\n')
  invoke(root, "add", "--ignore-scripts", "./core.tgz", "./html.tgz")
  const markdown = await readFile(
    new URL("../../html/examples/web-page.md", import.meta.url),
    "utf8",
  )
  await writeFile(join(root, "web-page.md"), markdown)
  const script = `
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { staticValueToAST } from "@matra/core"
import { buildLiterate, runLiterate, LiterateError } from "@matra/core/experimental/literate"
import { toHTML } from "@matra/html"
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
  await rm(manifestPath)
  await writeFile(manifestPath, JSON.stringify({ ...JSON.parse(manifest), abi: "unknown" }))
  execute(["verify.mjs"], { EXPECT_COMPILER_ERROR: "1" })
  await writeFile(manifestPath, manifest)
  await writeFile(
    join(root, "types.mts"),
    `
import { buildLiterate, runLiterate, LiterateError } from "@matra/core/experimental/literate"
import type { LiterateBundle, LiterateBuildOptions } from "@matra/core/experimental/literate"
const options: LiterateBuildOptions = { document: "example.md" }
const bundle: LiterateBundle = await buildLiterate("", options)
await runLiterate(bundle)
const inspect = (error: LiterateError): string => error.code + error.document + error.path + error.line
void inspect
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
    "Packed Core/HTML: public APIs, types, CLI, missing/corrupt compiler, and Rust-free execution passed.",
  )
} finally {
  await rm(root, { recursive: true, force: true })
}
