import { astToMatraJSON, parse, printJSON } from "@matra/core"
import { toSVG } from "@matra/graphics"
import { toHTML } from "@matra/html"

const TAGS = [
  "a", "article", "button", "canvas", "circle", "div", "ellipse", "footer",
  "form", "g", "h1", "h2", "header", "img", "input", "label", "li", "line",
  "main", "nav", "ol", "p", "path", "polygon", "rect", "section", "span", "svg",
  "table", "text", "textarea", "ul",
]
const MAGICS = ["%%html", "%%svg", "%%json", "%%ast"]
const HELP = {
  "%%html": "Render the cell as HTML (the default).",
  "%%svg": "Render the cell as SVG graphics.",
  "%%json": "Display compact MatraJSON.",
  "%%ast": "Display the object-shaped Matra AST.",
  "m-if": "Render an element only when its condition is true.",
  "m-each": "Repeat an element for every value in a collection.",
}

export function evaluate(source) {
  const { mode, code } = splitMagic(source)
  if (!code.trim()) return null
  const ast = parse(code)
  const json = printJSON(ast, { pretty: true })
  if (mode === "svg") {
    const svg = toSVG(ast)
    return { data: { "image/svg+xml": svg, "text/plain": svg }, metadata: {} }
  }
  if (mode === "json") {
    const matraJSON = astToMatraJSON(ast)
    return { data: { "application/json": matraJSON, "text/plain": printJSON(matraJSON, { pretty: true }) }, metadata: {} }
  }
  if (mode === "ast") {
    return { data: { "application/json": ast, "text/plain": json }, metadata: {} }
  }
  return {
    data: { "text/html": toHTML(ast), "application/json": ast, "text/plain": json },
    metadata: {},
  }
}

export function complete(code, cursor = code.length) {
  const before = code.slice(0, cursor)
  const match = before.match(/(?:%%|[A-Za-z][\w-]*)$/)
  const token = match?.[0] ?? ""
  const candidates = token.startsWith("%%") ? MAGICS : [...TAGS, "m-if", "m-each", "m-as"]
  return {
    matches: candidates.filter(item => item.startsWith(token)),
    cursor_start: cursor - token.length,
    cursor_end: cursor,
    metadata: {},
    status: "ok",
  }
}

export function inspect(code, cursor = code.length) {
  const left = code.slice(0, cursor)
  const word = left.match(/(?:%%|[A-Za-z$][\w-]*)$/)?.[0]
  if (!word) return { status: "ok", found: false, data: {}, metadata: {} }
  const description = HELP[word] ?? (TAGS.includes(word) ? `Matra element \`${word}\`.` : null)
  return description
    ? { status: "ok", found: true, data: { "text/plain": description, "text/markdown": description }, metadata: {} }
    : { status: "ok", found: false, data: {}, metadata: {} }
}

export function completeness(source) {
  if (!source.trim()) return { status: "complete" }
  const { code } = splitMagic(source)
  const stack = []
  let quote = null
  let escaped = false
  const pairs = { "(": ")", "[": "]", "{": "}" }
  for (const char of code) {
    if (quote) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === "`") quote = char
    else if (pairs[char]) stack.push(pairs[char])
    else if (Object.values(pairs).includes(char) && stack.pop() !== char) return { status: "invalid" }
  }
  if (quote || stack.length) return { status: "incomplete", indent: "  " }
  try {
    parse(code)
    return { status: "complete" }
  } catch {
    return { status: "invalid" }
  }
}

function splitMagic(source) {
  const match = source.match(/^\s*%%(html|svg|json|ast)\s*(?:\r?\n|$)/)
  return match
    ? { mode: match[1], code: source.slice(match[0].length) }
    : { mode: "html", code: source }
}
