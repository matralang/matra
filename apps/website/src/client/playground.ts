import { astToMatraJSON, parse, printJSON } from "@matra/core"
import { toSVG } from "@matra/graphics"
import { toHTML } from "@matra/html"
import { evaluateMatra, numericEvaluateMatra, numericEvaluateProps, simplifyMatra } from "@matra/math-compute-engine"

const source = required<HTMLTextAreaElement>("matra-source")
const status = required<HTMLElement>("playground-status")
const stats = required<HTMLElement>("source-stats")
const astOutput = required<HTMLElement>("ast-output")
const matraJSONOutput = required<HTMLElement>("matra-json-output")
const mathOutput = required<HTMLElement>("math-output")
const htmlOutput = required<HTMLElement>("html-output")
const svgOutput = required<HTMLElement>("svg-output")
const preview = required<HTMLIFrameElement>("preview-frame")
const errorCard = required<HTMLElement>("playground-error")
const errorMessage = required<HTMLElement>("playground-error-message")
const copyButton = required<HTMLButtonElement>("copy-output")
const downloadButton = required<HTMLButtonElement>("download-output")
const renderMode = required<HTMLSelectElement>("render-mode")

type OutputMode = "html" | "svg"
type ResultMode = OutputMode | "math"
type ProgramResult = string | { source: string; mode?: OutputMode }
type MatraTemplate = (strings: TemplateStringsArray, ...values: unknown[]) => string
type RawMatraSource = { readonly kind: "RawMatraSource"; readonly source: string }
type MatraFence = { filename: string; kind: "matra" | "matra.ts"; source: string }
type MatraRenderer = ResultMode | "auto"
type MatraDocument = MatraFence & { renderer: MatraRenderer; title?: string }

function markdown(filename: string, source: string, renderer: MatraRenderer = "html"): string {
  const title = filename.replace(/\.matra(?:\.ts)?$/, "").replace(/[-_]/g, " ")
  return `# ${title}\n\n---\nmatra:\n  entry: ${filename}\n  renderer: ${renderer}\n---\n\n\`\`\`${filename}\n${source}\n\`\`\``
}

const examples: Record<string, string> = {
  card: markdown("card.matra", `article.card {
  p.eyebrow { "MATRA" }
  h2 { "Structure first." }
  p { "Edit this source and watch it render." }
  a.button.primary[href="/spec/"] { "Read the spec" }
  hr;
}`),
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

matra {
  article.card {
    p.eyebrow { "JS / TS API" }
    h2 { \${title} }
    p { "Values use \${...}; braces remain structural." }
  }
}`),
  "js-graphics": markdown("graphics.matra.ts", `// Generate Matra graphics source with ordinary TypeScript values.
const dots = Array.from({ length: 7 }, (_, index) => {
  const x = 70 + index * 70
  const radius = 10 + index * 4
  return 'circle(cx=' + x + ', cy=180, r=' + radius + ', fill="#c8f135")'
})

matra {
  svg(
    width=560, height=360,
    rect(x=0, y=0, width=560, height=360, rx=24, fill="#101814"),
    \${raw(dots.join(",\\n    "))},
    text(x=48, y=70, fill="#ffffff", font-size=20, "GENERATED / TS")
  )
}`, "svg"),
}

let activePanel = "preview"
let latestOutputs = { ast: "", matraJSON: "", math: "", html: "", svg: "" }
let latestMode: ResultMode = "html"
let timer = 0

function render(): void {
  const program = source.value
  let value = program
  stats.textContent = `${value.length} chars · ${value.split("\n").length} lines`

  try {
    const document = extractMatraDocument(program)
    const programResult = document.kind === "matra.ts"
      ? runMatraTypeScriptProgram(document.source)
      : { source: document.source }
    value = programResult.source
    if (document.renderer === "math") {
      renderMath(value, document.filename)
      return
    }
    const parsedAst = parse(value, { locations: true, sourceId: "playground.matra" })
    const mode = document.renderer === "auto" && renderMode.value === "auto"
      ? (parsedAst.tag === "svg" || (parsedAst.tag === "$root" && parsedAst.children.some(child => isNode(child) && child.tag === "svg")) ? "svg" : "html")
      : document.renderer === "auto" ? renderMode.value as OutputMode : document.renderer
    const ast = mode === "svg"
      ? numericEvaluateProps(parsedAst)
      : document.title ? injectDocumentTitle(parsedAst, document.title) : parsedAst
    const matraJSON = printJSON(astToMatraJSON(ast), { pretty: true })
    const html = mode === "html" ? toHTML(ast) : ""
    const svg = mode === "svg" ? toSVG(ast, { pretty: true }) : ""
    latestMode = mode
    latestOutputs = { ast: JSON.stringify(ast, null, 2), matraJSON, math: "", html, svg }
    astOutput.textContent = latestOutputs.ast
    matraJSONOutput.textContent = matraJSON
    mathOutput.textContent = "front matterでrenderer: mathを指定すると、ここにCompute Engineの結果が表示されます。"
    htmlOutput.textContent = html
    svgOutput.textContent = svg || "SVG modeを選択すると、ここにSVG sourceが表示されます。"
    preview.srcdoc = previewDocument(mode === "svg" ? svg : html, mode, document.title)
    errorCard.hidden = true
    status.textContent = `Valid ${document.filename} · ${mode.toUpperCase()}`
    status.classList.remove("is-error")
  } catch (error) {
    errorMessage.textContent = error instanceof Error ? error.message : String(error)
    errorCard.hidden = false
    status.textContent = "Invalid source"
    status.classList.add("is-error")
  }
}

function renderMath(program: string, filename: string): void {
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
  latestOutputs = { ast: "", matraJSON: "", math: result, html: "", svg: "" }
  astOutput.textContent = "Math input is parsed as Matra application syntax, not document AST."
  matraJSONOutput.textContent = formatValue(simplified)
  mathOutput.textContent = result
  htmlOutput.textContent = ""
  svgOutput.textContent = ""
  preview.srcdoc = previewDocument(result, "math", filename)
  errorCard.hidden = true
  status.textContent = `Valid ${filename} · Compute Engine`
  status.classList.remove("is-error")
}

function scheduleRender(): void {
  window.clearTimeout(timer)
  timer = window.setTimeout(render, 120)
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
renderMode.addEventListener("change", render)
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
    render()
    source.focus()
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
  const content = latestMode === "svg" ? latestOutputs.svg : latestMode === "math" ? latestOutputs.math : latestOutputs.html
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
  if (panel === "math") return latestOutputs.math
  if (panel === "svg") return latestOutputs.svg
  if (latestMode === "math") return latestOutputs.math
  if (panel === "preview") return latestMode === "svg" ? latestOutputs.svg : latestOutputs.html
  return latestOutputs.html
}

function previewDocument(output: string, mode: ResultMode, title = "Matra Playground"): string {
  return `<!doctype html><html><head><title>${escapeHTML(title)}</title><style>
    :root{font-family:system-ui,sans-serif;color:#101814;background:#fbfaf5}
    body{margin:0;padding:32px}.graphics-preview{min-height:calc(100vh - 64px);display:grid;place-items:center}.graphics-preview svg{display:block;max-width:100%;height:auto;max-height:calc(100vh - 64px);filter:drop-shadow(0 18px 36px #10181422)}.math-preview{max-width:680px;margin:0;padding:28px;border:1px solid #d9d9cf;border-radius:14px;background:white;white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}.card,.demo{max-width:520px;padding:28px;border:1px solid #d9d9cf;border-radius:14px;background:white}
    .eyebrow{color:#657800;font:12px monospace;letter-spacing:.12em}.button{display:inline-block;margin-top:10px;padding:10px 16px;border-radius:999px;background:#101814;color:white;text-decoration:none}
  </style></head><body>${mode === "svg" ? `<main class="graphics-preview">${output}</main>` : mode === "math" ? `<pre class="math-preview">${escapeHTML(output)}</pre>` : output}</body></html>`
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

function runMatraTypeScriptProgram(program: string): { source: string; mode?: OutputMode } {
  const javaScript = compileMatraBlock(program)
  // The editor currently executes the JavaScript subset shared by JS and TS.
  // eslint-disable-next-line no-new-func
  const execute = new Function("m", "raw", `"use strict";\n${javaScript}`) as (
    m: MatraTemplate,
    raw: (source: string) => RawMatraSource,
  ) => ProgramResult
  const result = execute(matraTemplate, rawMatra)
  if (typeof result === "string") return { source: result }
  if (!result || typeof result.source !== "string") {
    throw new TypeError("A .matra.ts fence must produce Matra source.")
  }
  if (result.mode !== undefined && result.mode !== "html" && result.mode !== "svg") {
    throw new TypeError('mode must be either "html" or "svg".')
  }
  return result
}

function matraTemplate(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((result, chunk, index) => {
    const value = index < values.length ? matraSourceValue(values[index]) : ""
    return result + chunk + value
  }, "")
}

function matraSourceValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (isRawMatraSource(value)) return value.source
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "function") {
    throw new TypeError("Function values require the forthcoming Matra event runtime.")
  }
  if (Array.isArray(value)) return value.map(matraSourceValue).join("\n")
  return String(value)
}

function rawMatra(source: string): RawMatraSource {
  return { kind: "RawMatraSource", source }
}

function isRawMatraSource(value: unknown): value is RawMatraSource {
  return typeof value === "object" && value !== null &&
    "kind" in value && value.kind === "RawMatraSource" &&
    "source" in value && typeof value.source === "string"
}

function compileMatraBlock(program: string): string {
  const match = /\b(?:return\s+)?matra\s*\{/.exec(program)
  if (!match || match.index === undefined) {
    throw new SyntaxError("A .matra.ts fence must end with a `matra { ... }` block.")
  }

  const open = match.index + match[0].lastIndexOf("{")
  const close = matchingBrace(program, open)
  if (!/^[;\s]*$/.test(program.slice(close + 1))) {
    throw new SyntaxError("The `matra { ... }` block must be the final expression in a .matra.ts fence.")
  }
  const source = program.slice(open + 1, close)
  if (source.includes("`")) {
    throw new SyntaxError("Use quoted text in a Matra TypeScript block; backtick text is not supported.")
  }
  const templateSource = escapeTemplateSyntaxInStrings(source)
  return `${program.slice(0, match.index)}return m\`${templateSource}\`${program.slice(close + 1)}`
}

function extractMatraDocument(markdown: string): MatraDocument {
  const { entry, renderer, title } = parseMatraFrontMatter(markdown)
  const fences: MatraFence[] = []
  const pattern = /^[ \t]*```([^\s`]+)[^\n]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm
  for (const match of markdown.matchAll(pattern)) {
    const filename = match[1]
    const kind = filename.endsWith(".matra.ts")
      ? "matra.ts"
      : filename.endsWith(".matra")
        ? "matra"
        : undefined
    if (kind) fences.push({ filename, kind, source: match[2] })
  }
  if (fences.length === 0) {
    throw new SyntaxError("Markdown must contain one `*.matra` or `*.matra.ts` fenced code block.")
  }
  const fence = entry ? fences.find(candidate => candidate.filename === entry) : fences[0]
  if (!fence) {
    throw new SyntaxError(`The Matra entry '${entry}' was not found in this Markdown document.`)
  }
  if (!entry && fences.length > 1) {
    throw new SyntaxError("Set matra.entry in front matter when Markdown contains multiple Matra code blocks.")
  }
  return { ...fence, renderer, title: title === false ? undefined : title ?? extractMarkdownTitle(markdown) }
}

function parseMatraFrontMatter(markdown: string): { entry?: string; renderer: MatraRenderer; title?: string | false } {
  const frontMatter = markdown.match(/(?:^|\n)---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/)
  if (!frontMatter) return { renderer: "auto" }
  const matra = frontMatter[1].match(/^matra:\s*\n((?:^[ \t]+.*(?:\n|$))*)/m)
  if (!matra) return { renderer: "auto" }
  const entry = matra[1].match(/^[ \t]+entry:\s*([^\s#]+)\s*$/m)?.[1]
  const rawRenderer = matra[1].match(/^[ \t]+renderer:\s*(\S+)\s*$/m)?.[1] ?? "auto"
  const rawTitle = matra[1].match(/^[ \t]+title:\s*(.+?)\s*$/m)?.[1]
  if (rawRenderer !== "auto" && rawRenderer !== "html" && rawRenderer !== "svg" && rawRenderer !== "math") {
    throw new SyntaxError("matra.renderer must be one of auto, html, svg, or math.")
  }
  const title = rawTitle === "false" ? false : rawTitle?.replace(/^['"]|['"]$/g, "")
  return { entry, renderer: rawRenderer, title }
}

function extractMarkdownTitle(markdown: string): string | undefined {
  const withoutFrontMatter = markdown.replace(/(?:^|\n)---[ \t]*\n[\s\S]*?\n---[ \t]*(?:\n|$)/, "")
  return withoutFrontMatter.match(/^#\s+(.+?)\s*$/m)?.[1]
}

function injectDocumentTitle(ast: ReturnType<typeof parse>, title: string): ReturnType<typeof parse> {
  const heading = { tag: "h1", props: {}, children: [title] }
  if (ast.tag === "$root") return { ...ast, children: [heading, ...ast.children] }
  return { tag: "$root", props: {}, children: [heading, ast] }
}

function escapeTemplateSyntaxInStrings(source: string): string {
  let result = ""
  let quote = false
  let escaped = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote && character === "$" && source[index + 1] === "{") result += "\\"
    result += character
    if (!quote) {
      quote = character === '"'
      continue
    }
    if (escaped) escaped = false
    else if (character === "\\") escaped = true
    else if (character === '"') quote = false
  }
  return result
}

function matchingBrace(source: string, open: number): number {
  let depth = 0
  let quote = ""
  let escaped = false
  for (let index = open; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === quote) quote = ""
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === "{") depth += 1
    if (character === "}") {
      depth -= 1
      if (depth === 0) return index
    }
  }
  throw new SyntaxError("Unclosed Matra block.")
}

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing playground element: ${id}`)
  return element as T
}

render()
