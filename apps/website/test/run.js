import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

async function collectMarkdownPages(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) return collectMarkdownPages(fullPath)
    return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : []
  }))
  return files.flat()
}

const pageSources = await collectMarkdownPages(fileURLToPath(new URL("../src/pages", import.meta.url)))
assert.equal(pageSources.length, 11)
assert.ok(pageSources.every(page => page.endsWith(".md")))
for (const page of pageSources) {
  const source = await readFile(page, "utf8")
  assert.match(source, /^```+[^\n]*\.matra(?:\.ts)?\n/m, page)
}
const pageMarkdown = await Promise.all(pageSources.map(page => readFile(page, "utf8")))
const matraTypeScriptPages = pageMarkdown.filter(source => source.includes(".matra.ts"))
const nativeMatraPages = pageMarkdown.filter(source => source.includes("```page.matra\n"))
assert.equal(matraTypeScriptPages.length, 3)
assert.equal(nativeMatraPages.length, 8)
for (const source of nativeMatraPages) {
  assert.match(source, /^---\ntitle: .+\ndescription: .+\nlayout: (?:site|specification)\n---/)
  assert.doesNotMatch(source, /```page\.matra\nhtml\b/)
  assert.doesNotMatch(source, /~/)
}
for (const source of matraTypeScriptPages) {
  assert.match(source, /export default/)
  assert.match(source, /from "@matra\/core"/)
  assert.doesNotMatch(source, /matra\s*\{/)
}

execFileSync("pnpm", ["run", "build"], { stdio: "inherit" })

const index = await readFile(new URL("../dist/index.html", import.meta.url), "utf8")
const docs = await readFile(new URL("../dist/docs.html", import.meta.url), "utf8")
const packages = await readFile(new URL("../dist/packages.html", import.meta.url), "utf8")
const spec = await readFile(new URL("../dist/spec.html", import.meta.url), "utf8")
const specPages = await Promise.all([
  "data-model",
  "ast",
  "grammar",
  "parser",
].map(page => readFile(new URL(`../dist/spec/${page}.html`, import.meta.url), "utf8")))
const playground = await readFile(new URL("../dist/play.html", import.meta.url), "utf8")
const playgroundBundle = await readFile(new URL("../dist/assets/playground.js", import.meta.url), "utf8")
const playgroundWorker = await readFile(new URL("../dist/assets/matra-worker.js", import.meta.url), "utf8")
const playgroundSource = await readFile(new URL("../src/client/playground.ts", import.meta.url), "utf8")

for (const page of [
  "blog.html",
  "docs.html",
  "examples.html",
  "index.html",
  "packages.html",
  "play.html",
  "spec.html",
  "spec/data-model.html",
  "spec/ast.html",
  "spec/grammar.html",
  "spec/parser.html",
]) {
  const document = await readFile(new URL(`../dist/${page}`, import.meta.url), "utf8")
  assert.match(document, /^<!DOCTYPE html>\n<html/, page)
  assert.match(document, /<header class="site-header">/, page)
  assert.match(document, /<footer class="site-footer">/, page)
  assert.match(document, /fonts\.googleapis\.com/, page)
  assert.match(document, /fonts\.gstatic\.com/, page)
}

assert.match(index, /^<!DOCTYPE html>/)
assert.match(index, /<title>Matra — Structure first/)
assert.match(index, /https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=/)
assert.match(index, /GTM-T8JD7GH9/)
assert.match(index, /<noscript>\s*<iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-T8JD7GH9"/)
assert.match(index, /意味より先に、構造を書く/)
assert.match(index, /hello\.matra/)
assert.doesNotMatch(index, /hello\.matra\.ts/)
assert.match(index, /<code>group\(role=&quot;list&quot;\)/)
assert.match(docs, /<title>Matraを使う — Matra/)
assert.match(docs, /Language Specification/)
assert.match(packages, /公式パッケージ/)
const examples = await readFile(new URL("../dist/examples.html", import.meta.url), "utf8")
assert.match(examples, /render-html\.ts/)
assert.match(examples, /render-svg\.ts/)
assert.match(examples, /transform\.ts/)
assert.match(examples, /@matra\/graphics/)
assert.doesNotMatch(examples, /matra:render-/)
assert.match(spec, /<title>Matra Specification v0.2<\/title>/)
assert.match(spec, /Data Model/)
for (const page of specPages) {
  assert.match(page, /<aside class="docs-nav">/)
  assert.match(page, /<div class="shell docs-shell">/)
}
assert.match(specPages[1], /\n {11}↕\n/)
assert.match(specPages[2], /p`Body`/)
assert.doesNotMatch(specPages[2], /p\\`Body\\`/)
assert.match(playground, /<title>Playground — Matra/)
assert.match(playground, /id="matra-source"/)
assert.match(playground, /<textarea[^>]*># Card/)
assert.doesNotMatch(playground, /matra:playground\.md/)
assert.match(playground, /\/assets\/playground.js/)
assert.match(playgroundBundle, /srcdoc/)
assert.match(playground, /data-example="poster"/)
assert.match(playground, /data-example="landscape"/)
assert.match(playground, /Select a recipe to load it/)
assert.match(playground, /id="render-mode"/)
assert.match(playground, /id="stylesheet"/)
assert.match(playground, /water\.css/)
assert.match(playground, /data-example="js-card"/)
assert.match(playground, /data-example="js-graphics"/)
assert.match(playground, /data-example="program"/)
assert.match(playground, /Compile to Wasm/)
assert.match(playground, /id="renderer-output"/)
assert.match(playground, /id="matra-json-output"/)
assert.match(playgroundBundle, /image\/svg\+xml/)
assert.match(playgroundBundle, /Analytical engines/)
assert.match(playgroundBundle, /matra-json/)
assert.match(playgroundBundle, /GENERATED \/ TS/)
assert.match(playgroundBundle, /@matra\/styles/)
assert.match(playgroundBundle, /preventScroll/)
assert.match(playgroundBundle, /matra-worker\.js/)
assert.match(playgroundBundle, /matra-program-worker\.js/)
assert.match(playgroundBundle, /Matra TypeScript execution timed out/)
assert.match(playgroundWorker, /self\.addEventListener/)
const programWorker = await readFile(new URL("../dist/assets/matra-program-worker.js", import.meta.url), "utf8")
const programCompiler = await readFile(new URL("../dist/assets/matra-program-compiler.wasm", import.meta.url))
assert.match(programWorker, /WebAssembly\.instantiate/)
assert.ok(WebAssembly.validate(programCompiler))
assert.match(playgroundSource, /export default matra\\`/)
assert.doesNotMatch(playgroundSource, /matra\s*\{/)

execFileSync("pnpm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, SITE_BASE_PATH: "/website" },
})

const pagesIndex = await readFile(new URL("../dist/index.html", import.meta.url), "utf8")
const pagesPlayground = await readFile(new URL("../dist/play.html", import.meta.url), "utf8")

assert.match(pagesIndex, /href="\/website\/app\.css"/)
assert.match(pagesIndex, /href="\/website\/docs"/)
assert.match(pagesPlayground, /src="\/website\/assets\/playground\.js"/)
assert.doesNotMatch(pagesIndex, /href="\/(?!website\/)/)

console.log("site build test passed")
