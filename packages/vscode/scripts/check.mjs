import { readFile } from "node:fs/promises"

const files = [
  "package.json",
  "language-configuration.json",
  "syntaxes/matra.tmLanguage.json",
  "snippets/matra.json",
]

for (const file of files) {
  JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), "utf8"))
}

console.log(`Validated ${files.length} JSON files.`)
