import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const stylesheet = await readFile(new URL("../matra.css", import.meta.url), "utf8")
assert.match(stylesheet, /:root/)
assert.match(stylesheet, /h1/)
assert.match(stylesheet, /\.matra-callout/)
