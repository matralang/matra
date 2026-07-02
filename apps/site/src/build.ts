// @ts-ignore: allow importing fs without @types/node installed
import * as fs from "fs"
// @ts-ignore: allow importing path without @types/node installed
import * as path from "path"
// @ts-ignore: allow importing url without @types/node installed
import { pathToFileURL } from "url"
import { build } from "esbuild"

// Declare the Node `process` global when @types/node is not installed.
declare const process: any;

import { parse } from "@matra/core"
import { toHTML } from "@matra/html"

function getBasePath(): string {
  const raw = process.env.SITE_BASE_PATH?.trim() ?? ""
  if (!raw || raw === "/") return ""

  return `/${raw.replace(/^\/+|\/+$/g, "")}`
}

function applyBasePath(html: string, basePath: string): string {
  if (!basePath) return html

  // Prefix site-root URLs while leaving protocol-relative URLs (//example.com) alone.
  return html.replace(/\b(href|src)="\/(?!\/)/g, `$1="${basePath}/`)
}

function isIgnoredPath(relFromPages: string): boolean {
  // Normalize to POSIX-style for stable checks across OSes
  const rel = relFromPages.split(path.sep).join("/")
  // Ignore underscore-prefixed files/dirs anywhere (drafts, private helpers)
  // e.g. "_draft.ts", "_partials/foo.ts", "blog/_draft.ts"
  if (rel.split("/").some(seg => seg.startsWith("_"))) return true

  // Common non-page dirs
  if (rel.includes("/__tests__/") || rel.includes("/__mocks__/")) return true

  return false
}

// collect .ts files recursively
function collectTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const results: string[] = []
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      results.push(...collectTsFiles(full))
    } else if (ent.isFile() && full.endsWith(".ts") && !full.endsWith(".d.ts")) {
      results.push(full)
    }
  }
  return results
}

function toNuxtLikeOutputPath(pagesDirAbs: string, filePathAbs: string): string {
  // rel uses platform separators; normalize to posix for checks, but finally join with path
  const rel = path.relative(pagesDirAbs, filePathAbs) // e.g. "about.ts" or "about/index.ts"
  const noExt = rel.replace(/\.ts$/, "")

  // "index" (root) -> "index.html"
  if (noExt === "index") {
    return "index.html"
  }

  // ".../index" -> ".../index.html"
  if (noExt.endsWith(`${path.sep}index`)) {
    return noExt + ".html"
  }

  // "about" -> "about/index.html"
  // "blog/post" -> "blog/post/index.html"
  return path.join(noExt, "index.html")
}

function assertNoOutputCollisions(pagesDirAbs: string, filesAbs: string[]) {
  const seen = new Map<string, string>() // outRel -> inRel
  const collisions: Array<{ outRel: string; a: string; b: string }> = []

  for (const fp of filesAbs) {
    const outRel = toNuxtLikeOutputPath(pagesDirAbs, fp)
    const inRel = path.relative(pagesDirAbs, fp)
    const prev = seen.get(outRel)
    if (prev) {
      collisions.push({ outRel, a: prev, b: inRel })
    } else {
      seen.set(outRel, inRel)
    }
  }

  if (collisions.length > 0) {
    const msg =
      "Output path collision detected:\n" +
      collisions
        .map(c => `  - ${c.outRel} is produced by BOTH:\n      * ${c.a}\n      * ${c.b}`)
        .join("\n") +
      "\n\nFix: keep only one of the sources (e.g. prefer about/index.ts over about.ts), or rename one."
    throw new Error(msg)
  }
}

async function handler() {
  const pagesDir = path.join(process.cwd(), "src", "pages")
  const outputDir = path.join(process.cwd(), "dist")
  const pageFiles = collectTsFiles(pagesDir).filter(fp => {
    const rel = path.relative(pagesDir, fp)
    return !isIgnoredPath(rel)
  })

  console.log(`Found page files: ${pageFiles.map(p => path.relative(pagesDir, p)).join(", ")}`)

  const DOCTYPE = "<!DOCTYPE html>"
  const basePath = getBasePath()

  // Fail fast if multiple pages map to the same output file.
  assertNoOutputCollisions(pagesDir, pageFiles)
  fs.rmSync(outputDir, { recursive: true, force: true })

  await Promise.all(pageFiles.map(async (filePath: string) => {
    const pageModule = await import(pathToFileURL(filePath).toString())

    if (pageModule.default) {
      const outRel = toNuxtLikeOutputPath(pagesDir, filePath)
      const outputPath = path.join(outputDir, outRel)
      const outDir = path.dirname(outputPath)
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true })
      }

      // pageModule.default is Matra DSL string
      const ast = parse(pageModule.default)
      const htmlContent = DOCTYPE + applyBasePath(toHTML(ast), basePath)

      fs.writeFileSync(outputPath, htmlContent)
      console.log(`Generated HTML file at: ${outputPath}`)
    } else {
      console.warn(`No default export found in module: ${path.relative(pagesDir, filePath)}`)
    }
  }))

  const assetsDir = path.join(outputDir, "assets")
  fs.mkdirSync(assetsDir, { recursive: true })
  await build({
    entryPoints: [path.join(process.cwd(), "src", "client", "playground.ts")],
    outfile: path.join(assetsDir, "playground.js"),
    bundle: true,
    format: "esm",
    minify: true,
    sourcemap: true,
    target: ["es2022"],
  })
  console.log(`Generated browser bundle at: ${path.join(assetsDir, "playground.js")}`)
}

handler().catch(err => {
  console.error("Build failed:", err)
  process.exit(1)
})
