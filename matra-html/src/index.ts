import type {
  MatraAST,
  MatraASTChild,
  MatraProps,
} from "@matralang/core"

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
])

export interface HTMLOptions {
  /** Render the domain-neutral $root tag as a fragment. */
  rootTag?: string
}

/** Render a Matra AST using HTML semantics. */
export function toHTML(ast: MatraAST | MatraASTChild[], options: HTMLOptions = {}): string {
  if (isMatraAST(ast)) return renderNode(ast, options)
  return ast.map(child => renderChild(child, options)).join("")
}

function renderNode(node: MatraAST, options: HTMLOptions): string {
  const [tag, props, children] = node
  if (tag === (options.rootTag ?? "$root")) {
    return children.map(child => renderChild(child, options)).join("")
  }
  if (tag === "#comment") {
    return `<!--${String(children[0] ?? "")}-->`
  }

  const attrs = renderProps(props)
  if (VOID_ELEMENTS.has(tag.toLowerCase())) return `<${tag}${attrs}>`
  const content = children.map(child => renderChild(child, options)).join("")
  return `<${tag}${attrs}>${content}</${tag}>`
}

function renderChild(child: MatraASTChild, options: HTMLOptions): string {
  if (isMatraAST(child)) return renderNode(child, options)
  if (child === null) return ""
  if (typeof child === "object") return escapeHTML(JSON.stringify(child))
  return escapeHTML(String(child))
}

function renderProps(props: MatraProps): string {
  return Object.entries(props)
    .filter(([, value]) => value !== null && value !== false)
    .map(([key, value]) => {
      if (value === true) return ` ${key}`
      const serialized = Array.isArray(value) ? value.join(" ") : String(value)
      return ` ${key}="${escapeAttribute(serialized)}"`
    })
    .join("")
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function escapeAttribute(value: string): string {
  return escapeHTML(value)
}

function isMatraAST(value: unknown): value is MatraAST {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    typeof value[0] === "string" &&
    value[1] !== null &&
    typeof value[1] === "object" &&
    !Array.isArray(value[1]) &&
    Array.isArray(value[2])
  )
}

export default { toHTML }
