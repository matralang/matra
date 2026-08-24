// @ts-ignore: allow importing fs without @types/node installed
import * as fs from "fs"
// @ts-ignore: allow importing path without @types/node installed
import * as path from "path"
import { build } from "esbuild"

// Declare the Node `process` global when @types/node is not installed.
declare const process: any;

import { extractMarkdownFences, extractMatraMarkdown, parse } from "@matra/core"
import { toHTML } from "@matra/html"
import { pageLayout } from "./layouts/page.js"

type PageMetadata = {
  title: string
  description: string
  layout: "site" | "specification"
}

const siteHeader = parse(`
  header.site-header {
    div.shell.nav-shell {
      a.brand[href="/"] { span.brand-mark { "M" } span { "Matra" } }
      nav.site-nav[aria-label="メインナビゲーション"] {
        a[href="/docs/"] { "Docs" }
        a[href="/spec/"] { "Specification" }
        a[href="/play/"] { "Playground" }
        a[href="https://github.com/matralang/matra"] { "GitHub" }
      }
    }
  }
`)

const siteFooter = parse(`
  footer.site-footer {
    div.shell.footer-grid {
      div { strong { "Matra" } p { "Structure first. Domain later." } }
      p { "Matra Specification v0.2" }
    }
  }
`)

const specificationNavigation = parse(`
  aside.docs-nav {
    p { "SPECIFICATION 0.2" }
    nav[aria-label="仕様書"] {
      a[href="/spec/data-model/"] { span { "01" } "Data Model" }
      a[href="/spec/ast/"] { span { "02" } "AST" }
      a[href="/spec/grammar/"] { span { "03" } "Grammar" }
      a[href="/spec/parser/"] { span { "04" } "Parser" }
    }
  }
`)

const googleTagManagerBody = parse(`
  noscript {
    iframe[src="https://www.googletagmanager.com/ns.html?id=GTM-T8JD7GH9", height="0", width="0", style="display:none;visibility:hidden"] {}
  }
`)

const googleTagManagerHead = parse(`
  script~(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T8JD7GH9');~
`)

const sharedHeadNodes = parse(`
  $root {
    link[rel="icon", href="/favicon.ico", sizes="any"];
    link[rel="icon", href="/favicon.svg", type="image/svg+xml"];
    meta[property="og:image", content="/og-image.png"];
    meta[name="twitter:image", content="/og-image.png"];
    link[rel="preconnect", href="https://fonts.googleapis.com"];
    link[rel="preconnect", href="https://fonts.gstatic.com", crossorigin="anonymous"];
    link[href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap", rel="stylesheet"];
  }
`).children

function getBasePath(): string {
  const raw = process.env.SITE_BASE_PATH?.trim() ?? ""
  if (!raw || raw === "/") return ""

  return `/${raw.replace(/^\/+|\/+$/g, "")}`
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

function extractPageMetadata(markdown: string, filePath: string): PageMetadata {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) throw new SyntaxError(`Page metadata is required in ${filePath}`)

  const fields = Object.fromEntries(match[1]
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const separator = line.indexOf(":")
      if (separator < 1) throw new SyntaxError(`Invalid page metadata in ${filePath}: ${line}`)
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
    }))
  if (!fields.title || !fields.description) {
    throw new SyntaxError(`Page metadata must define title and description in ${filePath}`)
  }
  if (fields.layout && fields.layout !== "site" && fields.layout !== "specification") {
    throw new SyntaxError(`Unknown page layout '${fields.layout}' in ${filePath}`)
  }

  return {
    title: fields.title,
    description: fields.description,
    layout: fields.layout === "specification" ? "specification" : "site",
  }
}

// Collect Markdown documents that contain a native Matra page fence.
function collectPageFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const results: string[] = []
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      results.push(...collectPageFiles(full))
    } else if (ent.isFile() && full.endsWith(".md")) {
      results.push(full)
    }
  }
  return results
}

function toOutputPath(pagesDirAbs: string, filePathAbs: string): string {
  // rel uses platform separators; normalize to posix for checks, but finally join with path
  const rel = path.relative(pagesDirAbs, filePathAbs) // e.g. "about.md" or "about/index.md"
  const noExt = rel.replace(/\.md$/, "")

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
    const outRel = toOutputPath(pagesDirAbs, fp)
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

function isNode(value: unknown): value is { tag: string, props: Record<string, unknown>, children: unknown[] } {
  return value !== null && typeof value === "object" && !Array.isArray(value) && "tag" in value
}

function hasNode(nodes: unknown[], tag: string, prop?: [string, string]): boolean {
  return nodes.some(node =>
    isNode(node) && node.tag === tag && (!prop || node.props[prop[0]] === prop[1]),
  )
}

function applySiteChrome(ast: ReturnType<typeof parse>) {
  const head = ast.children.find(node => isNode(node) && node.tag === "head")
  const body = ast.children.find(node => isNode(node) && node.tag === "body")
  if (!isNode(head) || !isNode(body)) return ast

  for (const node of sharedHeadNodes) {
    if (isNode(node) && !hasNode(head.children, node.tag, ["href", String(node.props.href)])) {
      head.children.push(node)
    }
  }
  if (!hasNode(head.children, "script")) head.children.push(googleTagManagerHead)

  if (!hasNode(body.children, "noscript")) body.children.unshift(googleTagManagerBody)
  if (!hasNode(body.children, "header")) {
    const mainIndex = body.children.findIndex(node => isNode(node) && node.tag === "main")
    body.children.splice(mainIndex < 0 ? body.children.length : mainIndex, 0, siteHeader)
  }
  if (!hasNode(body.children, "footer")) body.children.push(siteFooter)
  return ast
}

function applySpecificationLayout(ast: ReturnType<typeof parse>, layout: PageMetadata["layout"]) {
  if (layout !== "specification") return ast

  const body = ast.children.find(node => isNode(node) && node.tag === "body")
  const main = body?.children.find(node => isNode(node) && node.tag === "main")
  if (!isNode(main) || hasNode(main.children, "aside")) return ast

  const content = main.children.find(node =>
    isNode(node) && node.tag === "article" && node.props.class === "docs-content",
  )
  if (!content) return ast

  main.children = [{
    tag: "div",
    props: { class: "shell docs-shell" },
    children: [specificationNavigation, content],
  }]
  return ast
}

function injectMarkdownCode(ast: ReturnType<typeof parse>, markdown: string, filePath: string) {
  const fences = new Map(extractMarkdownFences(markdown).map(fence => [fence.filename, fence.source]))

  const inject = (nodes: unknown[]) => {
    for (const node of nodes) {
      if (!isNode(node)) continue
      const reference = typeof node.props.src === "string"
        ? node.props.src
        : undefined
      if (reference?.startsWith("matra:")) {
        const filename = reference.slice("matra:".length)
        const source = fences.get(filename)
        if (source === undefined) {
          throw new SyntaxError(`Unknown Markdown code fence '${filename}' in ${filePath}`)
        }
        node.children = [source]
        delete node.props.src
      }
      inject(node.children)
    }
  }

  inject(ast.children)
  return ast
}

async function executeMatraModule(source: string, filePath: string): Promise<string> {
  const compiled = await build({
    stdin: {
      contents: source,
      sourcefile: `${filePath}.ts`,
      resolveDir: path.dirname(filePath),
      loader: "ts",
    },
    bundle: true,
    format: "cjs",
    platform: "node",
    target: ["node20"],
    write: false,
  })
  const module = { exports: {} as { default?: unknown } }
  // Source is repository-managed and bundled before it is evaluated.
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", compiled.outputFiles[0].text)(module, module.exports)
  if (typeof module.exports.default !== "string") {
    throw new TypeError(`A .matra.ts page must default-export Matra source: ${filePath}`)
  }
  return module.exports.default
}

async function handler() {
  const pagesDir = path.join(process.cwd(), "src", "pages")
  const outputDir = path.join(process.cwd(), "dist")
  const pageFiles = collectPageFiles(pagesDir).filter(fp => {
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
    const markdown = fs.readFileSync(filePath, "utf8")
    const pageEntry = extractMarkdownFences(markdown).some(fence => fence.filename === "page.matra.ts")
      ? "page.matra.ts"
      : "page.matra"
    const document = extractMatraMarkdown(markdown, { entry: pageEntry })
    const metadata = document.kind === "matra"
      ? extractPageMetadata(markdown, filePath)
      : undefined
    const source = document.kind === "matra.ts"
      ? await executeMatraModule(document.source, filePath)
      : pageLayout({ ...metadata!, content: document.source })
    const outRel = toOutputPath(pagesDir, filePath)
    const outputPath = path.join(outputDir, outRel)
    const outDir = path.dirname(outputPath)
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }

    const ast = applySpecificationLayout(
      applySiteChrome(injectMarkdownCode(
        parse(source, { sourceId: path.relative(process.cwd(), filePath) }),
        markdown,
        filePath,
      )),
      metadata?.layout ?? (path.relative(pagesDir, filePath).startsWith(`spec${path.sep}`)
        ? "specification"
        : "site"),
    )
    const htmlContent = `${DOCTYPE}\n${toHTML(ast, { basePath, pretty: true })}\n`

    fs.writeFileSync(outputPath, htmlContent)
    console.log(`Generated HTML file at: ${outputPath}`)
  }))

  const publicDir = path.join(process.cwd(), "src", "public")
  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, outputDir, { recursive: true })
  }

  const assetsDir = path.join(outputDir, "assets")
  fs.mkdirSync(assetsDir, { recursive: true })
  await build({
    entryPoints: {
      playground: path.join(process.cwd(), "src", "client", "playground.ts"),
      "matra-worker": path.join(process.cwd(), "src", "client", "matra-worker.ts"),
    },
    outdir: assetsDir,
    bundle: true,
    format: "esm",
    minify: true,
    sourcemap: true,
    target: ["es2022"],
    loader: { ".css": "text" },
    alias: {
      "@matra/core": path.resolve(process.cwd(), "src", "client", "core-browser.ts"),
      "@matra/graphics": path.resolve(process.cwd(), "../../packages/graphics/dist/index.js"),
      "@matra/math": path.resolve(process.cwd(), "../../packages/math/dist/index.js"),
      "@matra/math-compute-engine": path.resolve(process.cwd(), "../../packages/math-compute-engine/dist/index.js"),
    },
  })
  console.log(`Generated browser bundle at: ${path.join(assetsDir, "playground.js")}`)
}

handler().catch(err => {
  console.error("Build failed:", err)
  process.exit(1)
})
