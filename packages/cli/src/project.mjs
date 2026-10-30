import { copyFile, lstat, mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { staticValueToAST } from "@matra/core"
import { buildLiterate, runLiterate } from "@matra/core/experimental/literate"
import { toHTML } from "@matra/html"

const template = new URL("../templates/basic/", import.meta.url)
const stylesheet = new URL(import.meta.resolve("@matra/styles/matra.css"))

export async function initProject(directory) {
  const root = resolve(directory)
  const files = [
    ["index.md", await readFile(new URL("index.md", template))],
    [".gitignore", await readFile(new URL("gitignore", template))],
    ["matra.css", await readFile(stylesheet)],
    ["matra.css.LICENSE", await readFile(new URL("LICENSE", stylesheet))],
  ]
  await mkdir(root)
  for (const [name, content] of files) {
    await writeFile(join(root, name), content, { flag: "wx" })
  }
  return root
}

async function regularFile(path) {
  if (!(await lstat(path)).isFile()) {
    throw new Error(`Expected a regular file, not a directory or symlink: ${path}`)
  }
}

async function outputFile(path) {
  try {
    await regularFile(path)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
}

export async function buildProject(directory) {
  const root = resolve(directory)
  const source = join(root, "index.md")
  const css = join(root, "matra.css")
  const license = join(root, "matra.css.LICENSE")
  await regularFile(source)
  await regularFile(css)
  await regularFile(license)
  const bundle = await buildLiterate(await readFile(source, "utf8"), { document: "index.md" })
  const html = `<!doctype html>\n${toHTML(staticValueToAST(await runLiterate(bundle)))}\n`
  const output = join(root, "dist")
  try {
    await mkdir(output)
  } catch (error) {
    if (error.code !== "EEXIST") throw error
    if (!(await lstat(output)).isDirectory()) {
      throw new Error(`Expected an output directory, not a file or symlink: ${output}`)
    }
  }
  const htmlOutput = join(output, "index.html")
  const cssOutput = join(output, "matra.css")
  const licenseOutput = join(output, "matra.css.LICENSE")
  for (const path of [htmlOutput, cssOutput, licenseOutput]) await outputFile(path)
  await writeFile(htmlOutput, html, "utf8")
  await copyFile(css, cssOutput)
  await copyFile(license, licenseOutput)
  return htmlOutput
}
