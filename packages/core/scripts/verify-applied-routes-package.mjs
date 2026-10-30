import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const manager = process.env.npm_execpath
if (!manager) throw new Error("Run this verification with pnpm run test:applied-routes:package")
const managerInvocation = /\.(?:c|m)?js$/i.test(manager) ? [process.execPath, manager] : [manager]
const npmCli = [
  join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  join(dirname(dirname(process.execPath)), "lib", "node_modules", "npm", "bin", "npm-cli.js"),
].find(existsSync)
if (!npmCli) throw new Error("Could not locate npm bundled with the active Node.js installation")
const root = await mkdtemp(join(tmpdir(), "matra-applied-routes-"))
const packagesDirectory = join(root, "packages")
const packageDirectories = [
  fileURLToPath(new URL("../", import.meta.url)),
  fileURLToPath(new URL("../../graphics/", import.meta.url)),
  fileURLToPath(new URL("../../math/", import.meta.url)),
  fileURLToPath(new URL("../../math-compute-engine/", import.meta.url)),
  fileURLToPath(new URL("../../vscode/", import.meta.url)),
]
const packageNames = [
  "@matra/core",
  "@matra/graphics",
  "@matra/math",
  "@matra/math-compute-engine",
  "matra-vscode",
]
const invoke = (cwd, ...args) =>
  execFileSync(managerInvocation[0], [...managerInvocation.slice(1), ...args], {
    cwd,
    stdio: "inherit",
  })

try {
  await mkdir(packagesDirectory)
  const archives = packageDirectories.map((directory, index) => {
    const archive = join(packagesDirectory, `${packageNames[index].replace("/", "-")}.tgz`)
    invoke(directory, "pack", "--out", archive)
    return archive
  })

  const consumerDirectory = join(root, "consumer")
  const nodeModulesDirectory = join(consumerDirectory, "node_modules")
  const editorDirectory = join(nodeModulesDirectory, "matra-vscode")
  await mkdir(consumerDirectory)
  await writeFile(join(consumerDirectory, "package.json"), '{"private":true,"type":"module"}\n')
  execFileSync(
    process.execPath,
    [
      npmCli,
      "install",
      "--prefix",
      consumerDirectory,
      "--no-package-lock",
      "--no-save",
      "--ignore-scripts",
      ...archives,
    ],
    { cwd: root, stdio: "inherit" },
  )

  const editorManifest = JSON.parse(await readFile(join(editorDirectory, "package.json"), "utf8"))
  assert.equal(editorManifest.name, "matra-vscode")
  for (const relativePath of [
    "language-configuration.json",
    "syntaxes/matra.tmLanguage.json",
    "snippets/matra.json",
  ]) {
    await readFile(join(editorDirectory, relativePath), "utf8")
  }

  const verify = join(consumerDirectory, "verify.mjs")
  await writeFile(
    verify,
    `
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { compile } from "@matra/graphics"
import { mathJsonToContentMathML, normalizeContentMathML, parseMath, serializeContentMathML } from "@matra/math"
import { evaluateMatra } from "@matra/math-compute-engine"

const svg = compile('svg(width=64 height=64) { circle(cx=32 cy=32 r=20 fill="tomato") {} }')
assert.match(svg, /^<svg\\b/)
assert.match(svg, /width="64" height="64"/)
assert.ok(svg.includes('<circle cx="32" cy="32" r="20" fill="tomato"></circle>'))
assert.deepEqual(parseMath("Add(1, Power(x, 2))"), ["Add", 1, ["Power", "x", 2]])
assert.equal(evaluateMatra("Add(1, 2, 3)"), 6)
const mathML = serializeContentMathML(mathJsonToContentMathML(parseMath("Add(1, 2)")))
assert.ok(mathML.includes('<csymbol cd="arith1">plus</csymbol>'))
const normalized = normalizeContentMathML('<math xmlns="http://www.w3.org/1998/Math/MathML"><apply><plus/><cn>1</cn><cn>2</cn></apply></math>')
assert.ok(normalized.includes('<csymbol cd="arith1">plus</csymbol>'))

const editorDirectory = join(fileURLToPath(new URL(".", import.meta.url)), "node_modules/matra-vscode")
const editorManifest = JSON.parse(await readFile(join(editorDirectory, "package.json"), "utf8"))
const grammar = JSON.parse(await readFile(join(editorDirectory, editorManifest.contributes.grammars[0].path), "utf8"))
assert.equal(grammar.scopeName, "source.matra")
console.log("Packed Graphics, Math, Compute Engine, and VS Code editor consumer checks passed.")
`,
    { flag: "wx" },
  )
  execFileSync(process.execPath, [verify], { cwd: consumerDirectory, stdio: "inherit" })
} finally {
  await rm(root, { recursive: true, force: true })
}
