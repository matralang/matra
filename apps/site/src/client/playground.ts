import { parse } from "@matra/core"
import { toHTML } from "@matra/html"
import type { ParseOptions } from "@matra/core"

const source = required<HTMLTextAreaElement>("matra-source")
const mode = required<HTMLSelectElement>("syntax-mode")
const status = required<HTMLElement>("playground-status")
const stats = required<HTMLElement>("source-stats")
const astOutput = required<HTMLElement>("ast-output")
const htmlOutput = required<HTMLElement>("html-output")
const preview = required<HTMLIFrameElement>("preview-frame")
const errorCard = required<HTMLElement>("playground-error")
const errorMessage = required<HTMLElement>("playground-error-message")
const copyButton = required<HTMLButtonElement>("copy-output")

const examples: Record<string, string> = {
  card: `article.card {
  p.eyebrow\`MATRA / HTML\`
  h2\`Structure first.\`
  p\`Edit this source and watch it render.\`
  a.button.primary[href="/docs/"] \`Read the spec\`
}`,
  list: `$root {
  h2\`Specification\`
  ol {
    li\`Data Model\`
    li\`AST\`
    li\`Grammar\`
    li\`Parser\`
  }
}`,
  function: `section(
  h2("Function syntax"),
  p("Props become attributes."),
  button("Run", type="button"),
  class="demo"
)`,
}

let activePanel = "preview"
let latestOutputs = { ast: "", html: "" }
let timer = 0

function render(): void {
  const value = source.value
  stats.textContent = `${value.length} chars · ${value.split("\n").length} lines`

  try {
    const ast = parse(value, { syntaxMode: mode.value } as ParseOptions)
    const html = toHTML(ast)
    latestOutputs = { ast: JSON.stringify(ast, null, 2), html }
    astOutput.textContent = latestOutputs.ast
    htmlOutput.textContent = html
    preview.srcdoc = previewDocument(html)
    errorCard.hidden = true
    status.textContent = "Valid Matra"
    status.classList.remove("is-error")
  } catch (error) {
    errorMessage.textContent = error instanceof Error ? error.message : String(error)
    errorCard.hidden = false
    status.textContent = "Invalid source"
    status.classList.add("is-error")
  }
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
mode.addEventListener("change", render)

document.querySelectorAll<HTMLButtonElement>(".example-button").forEach(button => {
  button.addEventListener("click", () => {
    source.value = examples[button.dataset.example ?? "card"]
    mode.value = button.dataset.example === "function" ? "application" : "mixed"
    render()
    source.focus()
  })
})

document.querySelectorAll<HTMLButtonElement>(".result-tab").forEach(button => {
  button.addEventListener("click", () => selectPanel(button.dataset.panel ?? "preview"))
})

copyButton.addEventListener("click", async () => {
  const output = activePanel === "ast" ? latestOutputs.ast : latestOutputs.html
  await navigator.clipboard.writeText(output)
  copyButton.textContent = "Copied"
  window.setTimeout(() => { copyButton.textContent = "Copy" }, 1200)
})

function previewDocument(html: string): string {
  return `<!doctype html><html><head><style>
    :root{font-family:system-ui,sans-serif;color:#101814;background:#fbfaf5}
    body{margin:0;padding:32px}.card,.demo{max-width:520px;padding:28px;border:1px solid #d9d9cf;border-radius:14px;background:white}
    .eyebrow{color:#657800;font:12px monospace;letter-spacing:.12em}.button{display:inline-block;margin-top:10px;padding:10px 16px;border-radius:999px;background:#101814;color:white;text-decoration:none}
  </style></head><body>${html}</body></html>`
}

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing playground element: ${id}`)
  return element as T
}

render()
