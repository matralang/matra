import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"

execFileSync("npm", ["run", "build"], { stdio: "inherit" })

const index = await readFile(new URL("../dist/index.html", import.meta.url), "utf8")
const docs = await readFile(new URL("../dist/docs/index.html", import.meta.url), "utf8")

assert.match(index, /^<!DOCTYPE html>/)
assert.match(index, /<title>Matra — Structure first/)
assert.match(index, /意味より先に、構造を書く/)
assert.match(docs, /<title>Index — Matra Specification v0.1/)
assert.match(docs, /Data Model/)

console.log("site build test passed")
