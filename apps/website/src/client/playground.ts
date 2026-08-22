import { astToMatraJSON, extractMatraMarkdown, parse, printJSON } from "@matra/core"
import { toSVG } from "@matra/graphics"
import { toHTML } from "@matra/html"
import { parseMath } from "@matra/math"
import { evaluateMatra, numericEvaluateMatra, numericEvaluateProps, simplifyMatra } from "@matra/math-compute-engine"
import matraStyles from "../../../../packages/styles/matra.css"

const source = required<HTMLTextAreaElement>("matra-source")
const status = required<HTMLElement>("playground-status")
const stats = required<HTMLElement>("source-stats")
const astOutput = required<HTMLElement>("ast-output")
const matraJSONOutput = required<HTMLElement>("matra-json-output")
const expressionTab = required<HTMLButtonElement>("tab-matra-json")
const rendererOutput = required<HTMLElement>("renderer-output")
const preview = required<HTMLIFrameElement>("preview-frame")
const errorCard = required<HTMLElement>("playground-error")
const errorMessage = required<HTMLElement>("playground-error-message")
const copyButton = required<HTMLButtonElement>("copy-output")
const downloadButton = required<HTMLButtonElement>("download-output")
const renderMode = required<HTMLSelectElement>("render-mode")
const stylesheet = required<HTMLInputElement>("stylesheet")

type OutputMode = "html" | "svg"
type ResultMode = OutputMode | "math"
type MatraFence = { filename: string; kind: "matra" | "matra.ts"; source: string }
type MatraRenderer = ResultMode | "auto"
type MatraDocument = MatraFence & { renderer: MatraRenderer; title?: string; stylesheet?: string }

function markdown(
  filename: string,
  source: string,
  renderer: MatraRenderer = "html",
  frontMatter = true,
): string {
  const title = filename.replace(/\.matra(?:\.ts)?$/, "").replace(/[-_]/g, " ")
  const metadata = frontMatter
    ? `---\nmatra:\n  entry: ${filename}\n  renderer: ${renderer}\n---\n\n`
    : ""
  return `${metadata}# ${title}\n\n\`\`\`${filename}\n${source}\n\`\`\``
}

const examples: Record<string, string> = {
  card: markdown("card.matra", `article.matra-frame {
  p.eyebrow { "MATRA" }
  h2 { "Structure first." }
  p { "Edit this source and watch it render." }
  a.matra-button[href="/spec/"] { "Read the spec" }
  hr;
}`, "html", false),
  list: markdown("list.matra", `$root {
  h2 { "Specification" }
  ol {
    li { "Data Model" }
    li { "AST" }
    li { "Grammar" }
    li { "Parser" }
  }
}`),
  profile: markdown("profile.matra", `article.profile {
  p.eyebrow { "CONTRIBUTOR" }
  h2 { "Ada Lovelace" }
  p { "Mathematics, poetry, and the first algorithm." }
  dl {
    dt { "Focus" }
    dd { "Analytical engines" }
    dt { "Published" }
    dd { "1843" }
  }
}`),
  navigation: markdown("navigation.matra", `nav[aria-label="Main navigation"] {
  a.brand[href="/"] { "MATRA" }
  ul {
    li { a[href="/docs/"] { "Docs" } }
    li { a[href="/examples/"] { "Examples" } }
    li { a[href="/play/"] { "Playground" } }
  }
}`),
  article: markdown("article.matra", `main {
  article {
    header {
      p.eyebrow { "FIELD NOTE / 04" }
      h1 { "Structure is a way of seeing." }
      p { "A small document built from nested Matra nodes." }
    }
    section {
      h2 { "Start with the outline" }
      p { "Names, attributes, and children make the hierarchy visible." }
      blockquote { "Write the shape first; refine the meaning as it emerges." }
    }
    footer { small { "Published with Matra" } }
  }
}`),
  poster: markdown("poster.matra", `svg(
  width=640, height=400,
  defs(linearGradient(id="glow", stop(offset="0%", stop-color="#c8f135"), stop(offset="100%", stop-color="#39b7ff"))),
  rect(x=0, y=0, width=640, height=400, rx=28, fill="#101814"),
  circle(cx=500, cy=90, r=180, fill="url(#glow)", opacity=0.88),
  text(x=48, y=210, fill="#ffffff", font-size=72, font-weight=700, "MATRA"),
  text(x=52, y=252, fill="#c8f135", font-size=22, "structure becomes image")
)`, "svg"),
  orbit: markdown("orbit.matra", `svg(
  width=480, height=480,
  rect(x=0, y=0, width=480, height=480, fill="#f3f1e9"),
  circle(cx=240, cy=240, r=150, fill="none", stroke="#193e30", stroke-width=2),
  circle(cx=240, cy=240, r=82, fill="none", stroke="#193e30", stroke-width=2, stroke-dasharray="8 12"),
  circle(cx=390, cy=240, r=22, fill="#c8f135", stroke="#101814", stroke-width=4),
  circle(cx=240, cy=158, r=12, fill="#39b7ff"),
  circle(cx=240, cy=240, r=34, fill="#101814")
)`, "svg"),
  landscape: markdown("landscape.matra", `svg(
  width=640, height=400,
  rect(x=0, y=0, width=640, height=400, fill="#e9f4f1"),
  circle(cx=520, cy=92, r=48, fill="#c8f135"),
  path(d="M0 280 L170 115 L330 280 Z", fill="#315f50"),
  path(d="M150 310 L390 105 L640 310 Z", fill="#193e30"),
  path(d="M0 300 Q160 250 320 310 T640 290 V400 H0 Z", fill="#39b7ff", opacity=0.75)
)`, "svg"),
  signal: markdown("signal.matra", `svg(
  width=640, height=360,
  rect(x=0, y=0, width=640, height=360, rx=24, fill="#101814"),
  line(x1=80, y1=180, x2=560, y2=180, stroke="#435149", stroke-width=2),
  path(d="M80 180 L150 180 L180 90 L225 270 L270 135 L310 180 L560 180", fill="none", stroke="#c8f135", stroke-width=8, stroke-linecap="round", stroke-linejoin="round"),
  circle(cx=180, cy=90, r=10, fill="#39b7ff"),
  text(x=80, y=65, fill="#ffffff", font-size=18, font-family="monospace", "SIGNAL / 01")
)`, "svg"),
  "compute-engine": markdown("formula.matra", "Add(Power(2, 10), Factorial(5), Sin(Divide(Pi, 2)))", "math"),
  "js-card": markdown("card.matra.ts", `// TypeScript-compatible values are embedded with \${...}.
const title = "Matra from JavaScript"

export default matra\`
  article.card {
    p.eyebrow { "JS / TS API" }
    h2 { \${title} }
    p { "Values use \\\${...}; braces remain structural." }
  }
\``),
  "js-graphics": markdown("graphics.matra.ts", `// Generate Matra graphics source with ordinary TypeScript values.
const dots = Array.from({ length: 7 }, (_, index) => {
  const x = 70 + index * 70
  const radius = 10 + index * 4
  return \`circle(cx=\${x}, cy=180, r=\${radius}, fill="#c8f135")\`
})

export default matra\`
  svg(
    width=560, height=360,
    rect(x=0, y=0, width=560, height=360, rx=24, fill="#101814"),
    \${matra.raw(dots.join(",\\n    "))},
    text(x=48, y=70, fill="#ffffff", font-size=20, "GENERATED / TS")
  )
\``, "svg"),
}

let activePanel = "preview"
let latestOutputs = { ast: "", matraJSON: "", renderer: "" }
let latestMode: ResultMode = "html"
let timer = 0
let renderVersion = 0
let workerSequence = 0

async function render(): Promise<void> {
  const version = ++renderVersion
  const program = source.value
  let value = program
  stats.textContent = `${value.length} chars · ${value.split("\n").length} lines`

  try {
    const document = extractMatraDocument(program)
    const programResult = document.kind === "matra.ts"
      ? await runMatraTypeScriptProgram(document.source)
      : { source: document.source }
    if (version !== renderVersion) return
    value = programResult.source
    const selectedStylesheet = document.stylesheet ?? stylesheet.value
    if (document.renderer === "math") {
      renderMath(value, document.filename, selectedStylesheet)
      return
    }
    const parsedAst = parse(value, { locations: true, sourceId: "playground.matra" })
    const mode = document.renderer === "auto" && renderMode.value === "auto"
      ? (parsedAst.tag === "svg" || (parsedAst.tag === "$root" && parsedAst.children.some(child => isNode(child) && child.tag === "svg")) ? "svg" : "html")
      : document.renderer === "auto" ? renderMode.value as OutputMode : document.renderer
    const ast = mode === "svg"
      ? numericEvaluateProps(parsedAst)
      : document.title ? injectDocumentTitle(parsedAst, document.title) : parsedAst
    setExpressionTabLabel("MatraJSON")
    const matraJSON = printJSON(astToMatraJSON(ast), { pretty: true })
    const html = mode === "html" ? toHTML(ast) : ""
    const svg = mode === "svg" ? toSVG(ast, { pretty: true }) : ""
    latestMode = mode
    latestOutputs = { ast: JSON.stringify(ast, null, 2), matraJSON, renderer: mode === "svg" ? svg : html }
    astOutput.textContent = latestOutputs.ast
    matraJSONOutput.textContent = matraJSON
    rendererOutput.textContent = latestOutputs.renderer
    preview.srcdoc = previewDocument(mode === "svg" ? svg : html, mode, document.title, selectedStylesheet)
    errorCard.hidden = true
    status.textContent = `Valid ${document.filename} · ${mode.toUpperCase()} · ${stylesheetLabel(selectedStylesheet)}`
    status.classList.remove("is-error")
  } catch (error) {
    if (version !== renderVersion) return
    errorMessage.textContent = error instanceof Error ? error.message : String(error)
    errorCard.hidden = false
    status.textContent = "Invalid source"
    status.classList.add("is-error")
  }
}

function renderMath(program: string, filename: string, selectedStylesheet: string): void {
  const ast = parse(program, { locations: true, sourceId: "playground.matra", syntaxMode: "application" })
  const mathJSON = parseMath(program)
  const evaluated = evaluateMatra(program)
  const simplified = simplifyMatra(program)
  const numeric = numericEvaluateMatra(program)
  const result = [
    "Input",
    program,
    "",
    "Evaluate",
    formatValue(evaluated),
    "",
    "Simplify",
    formatValue(simplified),
    "",
    "Numeric",
    formatValue(numeric),
  ].join("\n")

  latestMode = "math"
  latestOutputs = {
    ast: JSON.stringify(ast, null, 2),
    matraJSON: printJSON(mathJSON, { pretty: true }),
    renderer: result,
  }
  setExpressionTabLabel("MathJSON")
  astOutput.textContent = latestOutputs.ast
  matraJSONOutput.textContent = latestOutputs.matraJSON
  rendererOutput.textContent = result
  preview.srcdoc = previewDocument(result, "math", filename, selectedStylesheet)
  errorCard.hidden = true
  status.textContent = `Valid ${filename} · Compute Engine · ${stylesheetLabel(selectedStylesheet)}`
  status.classList.remove("is-error")
}

function setExpressionTabLabel(label: "MatraJSON" | "MathJSON"): void {
  expressionTab.textContent = label
  expressionTab.setAttribute("aria-label", label)
}

function scheduleRender(): void {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => void render(), 120)
}

function selectPanel(name: string): void {
  activePanel = name
  document.querySelectorAll<HTMLElement>(".result-tab").forEach(tab => {
    const active = tab.dataset.panel === name
    tab.classList.toggle("active", active)
    tab.setAttribute("aria-selected", String(active))
  })
  document.querySelectorAll<HTMLElement>(".result-view").forEach(panel => {
    panel.classList.toggle("active", panel.id === `panel-${name}`)
  })
}

source.addEventListener("input", scheduleRender)
renderMode.addEventListener("change", () => void render())
stylesheet.addEventListener("change", () => void render())
document.querySelectorAll<HTMLButtonElement>(".example-button").forEach(button => {
  button.addEventListener("click", () => {
    const example = button.dataset.example ?? "card"
    source.value = examples[example]
    renderMode.value = "auto"
    document.querySelectorAll<HTMLButtonElement>(".example-button").forEach(item => {
      const active = item === button
      item.classList.toggle("active", active)
      item.setAttribute("aria-pressed", String(active))
    })
    void render()
    source.focus({ preventScroll: true })
  })
})

document.querySelectorAll<HTMLButtonElement>(".result-tab").forEach(button => {
  button.addEventListener("click", () => selectPanel(button.dataset.panel ?? "preview"))
})

copyButton.addEventListener("click", async () => {
  const output = outputForPanel(activePanel)
  await navigator.clipboard.writeText(output)
  copyButton.textContent = "Copied"
  window.setTimeout(() => { copyButton.textContent = "Copy" }, 1200)
})

downloadButton.addEventListener("click", () => {
  const content = latestOutputs.renderer
  const extension = latestMode === "svg" ? "svg" : latestMode === "math" ? "txt" : "html"
  const blob = new Blob([content], { type: latestMode === "svg" ? "image/svg+xml" : latestMode === "math" ? "text/plain" : "text/html" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `matra-output.${extension}`
  link.click()
  URL.revokeObjectURL(link.href)
})

function outputForPanel(panel: string): string {
  if (panel === "ast") return latestOutputs.ast
  if (panel === "matra-json") return latestOutputs.matraJSON
  if (panel === "output" || panel === "preview") return latestOutputs.renderer
  return latestOutputs.renderer
}

function previewDocument(output: string, mode: ResultMode, title = "Matra Playground", selectedStylesheet = "matra"): string {
  const stylesheetTag = previewStylesheet(selectedStylesheet)
  const utilityStyles = `.graphics-preview{min-height:calc(100vh - 64px);display:grid;place-items:center}.graphics-preview svg{display:block;max-width:100%;height:auto;max-height:calc(100vh - 64px);filter:drop-shadow(0 18px 36px #10181422)}.math-preview{max-width:680px;margin:0;padding:28px;white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}`
  return `<!doctype html><html><head><title>${escapeHTML(title)}</title>${stylesheetTag}<style>${utilityStyles}</style></head><body>${mode === "svg" ? `<main class="graphics-preview">${output}</main>` : mode === "math" ? `<pre class="math-preview">${escapeHTML(output)}</pre>` : output}</body></html>`
}

const stylesheetPresets: Record<string, string | undefined> = {
  matra: undefined,
  "water.css": "https://cdn.jsdelivr.net/npm/water.css@2/out/water.css",
  "simple.css": "https://cdn.jsdelivr.net/npm/simpledotcss@2/simple.min.css",
  "pico.css": "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css",
}

function previewStylesheet(value: string): string {
  const normalized = value.trim().toLowerCase() || "matra"
  if (normalized === "matra") return `<style>${matraStyles}</style>`
  const href = stylesheetPresets[normalized] ?? validatedStylesheetURL(value)
  if (!href) throw new SyntaxError("Stylesheet must be matra, water.css, simple.css, pico.css, or an HTTPS CSS URL.")
  return `<link rel="stylesheet" href="${escapeHTML(href)}">`
}

function stylesheetLabel(value: string): string {
  return value.trim() || "matra"
}

function validatedStylesheetURL(value: string): string | undefined {
  try {
    const url = new URL(value.trim())
    return url.protocol === "https:" ? url.href : undefined
  } catch {
    return undefined
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value)
  return printJSON(value, { pretty: true })
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
  }[character] ?? character))
}

function isNode(value: unknown): value is { tag: string } {
  return typeof value === "object" && value !== null && "tag" in value
}

async function runMatraTypeScriptProgram(program: string): Promise<{ source: string, mode?: OutputMode }> {
  const id = ++workerSequence
  const worker = new Worker(new URL("./matra-worker.js", import.meta.url), { type: "module" })
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate()
      reject(new Error("Matra TypeScript execution timed out after 500ms."))
    }, 500)
    const finish = () => {
      window.clearTimeout(timeout)
      worker.terminate()
    }
    worker.addEventListener("message", event => {
      const result = event.data as { id: number, source?: string, error?: string }
      if (result.id !== id) return
      finish()
      if (result.error) reject(new Error(result.error))
      else resolve({ source: result.source ?? "" })
    })
    worker.addEventListener("error", () => {
      finish()
      reject(new Error("Matra TypeScript worker failed."))
    })
    worker.postMessage({ id, program })
  })
}

function extractMatraDocument(markdown: string): MatraDocument {
  const { entry, renderer, title, stylesheet } = parseMatraFrontMatter(markdown)
  const fence = extractMatraMarkdown(markdown, { entry })
  return { ...fence, renderer, title: title === false ? undefined : title ?? extractMarkdownTitle(markdown), stylesheet }
}

function parseMatraFrontMatter(markdown: string): { entry?: string; renderer: MatraRenderer; title?: string | false; stylesheet?: string } {
  const frontMatter = markdown.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/)
  if (!frontMatter) return { renderer: "html" }
  const matra = frontMatter[1].match(/^matra:\s*\n((?:^[ \t]+.*(?:\n|$))*)/m)
  if (!matra) return { renderer: "html" }
  const entry = matra[1].match(/^[ \t]+entry:\s*([^\s#]+)\s*$/m)?.[1]
  const rawRenderer = matra[1].match(/^[ \t]+renderer:\s*(\S+)\s*$/m)?.[1] ?? "html"
  const rawTitle = matra[1].match(/^[ \t]+title:\s*(.+?)\s*$/m)?.[1]
  const rawStylesheet = matra[1].match(/^[ \t]+stylesheet:\s*(.+?)\s*$/m)?.[1]
  if (rawRenderer !== "auto" && rawRenderer !== "html" && rawRenderer !== "svg" && rawRenderer !== "math") {
    throw new SyntaxError("matra.renderer must be one of auto, html, svg, or math.")
  }
  const title = rawTitle === "false" ? false : rawTitle?.replace(/^['"]|['"]$/g, "")
  const stylesheet = rawStylesheet?.replace(/^['"]|['"]$/g, "")
  return { entry, renderer: rawRenderer, title, stylesheet }
}

function extractMarkdownTitle(markdown: string): string | undefined {
  const withoutFrontMatter = markdown.replace(/^---[ \t]*\n[\s\S]*?\n---[ \t]*(?:\n|$)/, "")
  return withoutFrontMatter.match(/^#\s+(.+?)\s*$/m)?.[1]
}

function injectDocumentTitle(ast: ReturnType<typeof parse>, title: string): ReturnType<typeof parse> {
  const heading = { tag: "h1", props: {}, children: [title] }
  if (ast.tag === "$root") return { ...ast, children: [heading, ...ast.children] }
  return { tag: "$root", props: {}, children: [heading, ast] }
}

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing playground element: ${id}`)
  return element as T
}

void render()
