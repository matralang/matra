import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"

execFileSync("pnpm", ["run", "build"], { stdio: "inherit" })

const index = await readFile(new URL("../dist/index.html", import.meta.url), "utf8")
const docs = await readFile(new URL("../dist/docs/index.html", import.meta.url), "utf8")
const spec = await readFile(new URL("../dist/spec/index.html", import.meta.url), "utf8")
const playground = await readFile(new URL("../dist/play/index.html", import.meta.url), "utf8")
const playgroundBundle = await readFile(new URL("../dist/assets/playground.js", import.meta.url), "utf8")

assert.match(index, /^<!DOCTYPE html>/)
assert.match(index, /<title>Matra — Structure first/)
assert.match(index, /https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=/)
assert.match(index, /GTM-T8JD7GH9/)
assert.match(index, /<noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-T8JD7GH9"/)
assert.match(index, /意味より先に、構造を書く/)
assert.match(docs, /<title>Matraを使う — Matra/)
assert.match(spec, /<title>Index — Matra Specification v0.2/)
assert.match(spec, /Data Model/)
assert.match(playground, /<title>Playground — Matra/)
assert.match(playground, /id="matra-source"/)
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
assert.match(playground, /id="svg-output"/)
assert.match(playground, /id="matra-json-output"/)
assert.match(playgroundBundle, /image\/svg\+xml/)
assert.match(playgroundBundle, /Analytical engines/)
assert.match(playgroundBundle, /matra-json/)
assert.match(playgroundBundle, /GENERATED \/ TS/)
assert.match(playgroundBundle, /@matra\/styles/)

execFileSync("pnpm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, SITE_BASE_PATH: "/website" },
})

const pagesIndex = await readFile(new URL("../dist/index.html", import.meta.url), "utf8")
const pagesPlayground = await readFile(new URL("../dist/play/index.html", import.meta.url), "utf8")

assert.match(pagesIndex, /href="\/website\/app\.css"/)
assert.match(pagesIndex, /href="\/website\/docs\/"/)
assert.match(pagesPlayground, /src="\/website\/assets\/playground\.js"/)
assert.doesNotMatch(pagesIndex, /href="\/(?!website\/)/)

console.log("site build test passed")
