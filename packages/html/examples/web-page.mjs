import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { staticValueToAST } from "@matra/core"
import { toHTML } from "@matra/html"
import { buildLiterate, runLiterate } from "../../../crates/matra-seed/host/literate-runtime.mjs"

export const sourceURL = new URL("./web-page.md", import.meta.url)

export async function renderWebPage(markdown) {
  const bundle = await buildLiterate(markdown, { document: "web-page.md" })
  const value = await runLiterate(bundle)
  const ast = staticValueToAST(value)
  return `<!doctype html>\n${toHTML(ast)}\n`
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const output = new URL("./dist/", import.meta.url)
  const html = await renderWebPage(await readFile(sourceURL, "utf8"))
  const css = await readFile(new URL("../../styles/matra.css", import.meta.url), "utf8")
  await mkdir(output, { recursive: true })
  await writeFile(new URL("index.html", output), html)
  await writeFile(new URL("matra.css", output), css)
  console.log(`Generated: ${new URL("index.html", output).pathname}`)
}
