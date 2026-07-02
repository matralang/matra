import assert from "node:assert/strict"
import test from "node:test"
import { complete, completeness, evaluate, inspect } from "../src/runtime.js"

test("renders HTML with a rich MIME bundle", () => {
  const result = evaluate('div(class="card", p("Hello"))')
  assert.equal(result.data["text/html"], '<div class="card"><p>Hello</p></div>')
  assert.equal(result.data["application/json"].tag, "div")
})

test("renders SVG using a cell magic", () => {
  const result = evaluate('%%svg\nsvg(width=20, height=20, circle(cx=10, cy=10, r=5))')
  assert.match(result.data["image/svg+xml"], /^<svg/)
  assert.match(result.data["image/svg+xml"], /<circle/)
})

test("distinguishes compact MatraJSON from the object AST", () => {
  assert.ok(Array.isArray(evaluate('%%json\np("Hello")').data["application/json"]))
  assert.equal(evaluate('%%ast\np("Hello")').data["application/json"].tag, "p")
})

test("supports completion, inspection, and completeness", () => {
  assert.ok(complete("di", 2).matches.includes("div"))
  assert.equal(inspect("%%svg", 5).found, true)
  assert.equal(completeness("div {").status, "incomplete")
  assert.equal(completeness('p("ok")').status, "complete")
})
