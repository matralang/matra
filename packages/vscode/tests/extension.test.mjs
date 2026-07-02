import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { readFile } from "node:fs/promises"
import test from "node:test"

const require = createRequire(import.meta.url)
const { analyze, format } = require("../src/analyzer.js")

const load = async (path) =>
  JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"))

test("registers .matra files and the Matra grammar", async () => {
  const manifest = await load("package.json")
  assert.deepEqual(manifest.contributes.languages[0].extensions, [".matra"])
  assert.equal(manifest.contributes.grammars[0].scopeName, "source.matra")
  assert.equal(manifest.contributes.grammars[0].language, "matra")
})

test("references files that contain valid JSON", async () => {
  const manifest = await load("package.json")
  await Promise.all([
    load(manifest.contributes.languages[0].configuration.replace("./", "")),
    load(manifest.contributes.grammars[0].path.replace("./", "")),
    load(manifest.contributes.snippets[0].path.replace("./", "")),
  ])
})

test("grammar covers both Matra syntax forms and interpolation", async () => {
  const grammar = await load("syntaxes/matra.tmLanguage.json")
  const includes = grammar.patterns.map(({ include }) => include)
  assert.ok(includes.includes("#function-tags"))
  assert.ok(includes.includes("#block-tags"))
  assert.ok(includes.includes("#interpolation"))
  assert.ok(grammar.repository.strings.patterns.length >= 3)
})

test("editor and grammar regular expressions compile", async () => {
  const configuration = await load("language-configuration.json")
  new RegExp(configuration.wordPattern)
  new RegExp(configuration.indentationRules.increaseIndentPattern)
  new RegExp(configuration.indentationRules.decreaseIndentPattern)

  const grammar = await load("syntaxes/matra.tmLanguage.json")
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== "object") return
    for (const key of ["match", "begin", "end"]) {
      if (value[key]) new RegExp(value[key])
    }
    Object.values(value).forEach(visit)
  }
  visit(grammar)
})

test("analyzer reports bracket errors and produces folding ranges", () => {
  const valid = analyze('div {\n  p("Hello")\n}')
  assert.deepEqual(valid.errors, [])
  assert.deepEqual(valid.folds, [
    { start: 1, end: 1 },
    { start: 0, end: 2 },
  ].filter(({ start, end }) => end > start))

  const invalid = analyze("div {\n  p(\"Hello\")")
  assert.equal(invalid.errors.length, 1)
  assert.match(invalid.errors[0].message, /閉じ括弧/)
})

test("analyzer supplies symbols for function and block syntax", () => {
  const names = analyze('main {\n  h1("Title")\n  p { "Text" }\n}').symbols.map(({ name }) => name)
  assert.deepEqual(names, ["main", "h1", "p"])
})

test("formatter indents nested Matra structures", () => {
  const source = 'div {\np("Hello")\nsection {\nspan("Text")\n}\n}'
  assert.equal(
    format(source, { insertSpaces: true, tabSize: 2 }),
    'div {\n  p("Hello")\n  section {\n    span("Text")\n  }\n}',
  )
})
