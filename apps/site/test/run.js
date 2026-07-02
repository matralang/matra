import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"

execFileSync("npm", ["run", "build"], { stdio: "inherit" })

const index = await readFile(new URL("../dist/index.html", import.meta.url), "utf8")
const docs = await readFile(new URL("../dist/docs/index.html", import.meta.url), "utf8")
const playground = await readFile(new URL("../dist/playground/index.html", import.meta.url), "utf8")
const playgroundBundle = await readFile(new URL("../dist/assets/playground.js", import.meta.url), "utf8")

assert.match(index, /^<!DOCTYPE html>/)
assert.match(index, /<title>Matra — Structure first/)
assert.match(index, /意味より先に、構造を書く/)
assert.match(docs, /<title>Index — Matra Specification v0.2/)
assert.match(docs, /Data Model/)
assert.match(playground, /<title>Playground — Matra/)
assert.match(playground, /id="matra-source"/)
assert.match(playground, /\/assets\/playground.js/)
assert.match(playgroundBundle, /srcdoc/)

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, SITE_BASE_PATH: "/matra" },
})

const pagesIndex = await readFile(new URL("../dist/index.html", import.meta.url), "utf8")
const pagesPlayground = await readFile(new URL("../dist/playground/index.html", import.meta.url), "utf8")

assert.match(pagesIndex, /href="\/matra\/app\.css"/)
assert.match(pagesIndex, /href="\/matra\/docs\/"/)
assert.match(pagesPlayground, /src="\/matra\/assets\/playground\.js"/)
assert.doesNotMatch(pagesIndex, /href="\/(?!matra\/)/)

console.log("site build test passed")
