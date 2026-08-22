import type {
  MatraAST,
  MatraASTChild,
  MatraProps,
} from "@matra/core"

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
])

export interface HTMLOptions {
  /** Render the domain-neutral $root tag as a fragment. */
  rootTag?: string
  /** Prefix site-root href and src attributes for static site deployments. */
  basePath?: string
  /** Add indentation and line breaks without changing text-node content. */
  pretty?: boolean
}

/** Render a Matra AST using HTML semantics. */
export function toHTML(ast: MatraAST | MatraASTChild[], options: HTMLOptions = {}): string {
  if (isMatraAST(ast)) return renderNode(ast, options)
  return ast.map(child => renderChild(child, options)).join(options.pretty ? "\n" : "")
}

function renderNode(node: MatraAST, options: HTMLOptions, depth = 0): string {
  const { tag, props, children } = node
  const indentation = options.pretty ? "  ".repeat(depth) : ""
  if (tag === (options.rootTag ?? "$root")) {
    return children.map(child => renderChild(child, options, depth)).join(options.pretty ? "\n" : "")
  }
  if (tag === "#comment") {
    return `${indentation}<!--${String(children[0] ?? "")}-->`
  }

  const attrs = renderProps(props, options)
  if (VOID_ELEMENTS.has(tag.toLowerCase())) return `${indentation}<${tag}${attrs}>`

  const preservesContent = tag === "script" || tag === "style" || tag === "pre" || tag === "textarea" || tag === "code"
  const hasOnlyElementChildren = children.every(child => isMatraAST(child))
  if (!options.pretty || preservesContent || !hasOnlyElementChildren) {
    const content = children
      .map(child => tag === "script" && typeof child === "string"
        ? child
        : renderChild(child, options))
      .join("")
    return `${indentation}<${tag}${attrs}>${content}</${tag}>`
  }

  if (children.length === 0) return `${indentation}<${tag}${attrs}></${tag}>`
  const content = children.map(child => renderChild(child, options, depth + 1)).join("\n")
  return `${indentation}<${tag}${attrs}>\n${content}\n${indentation}</${tag}>`
}

function renderChild(child: MatraASTChild, options: HTMLOptions, depth = 0): string {
  if (isMatraAST(child)) return renderNode(child, options, depth)
  if (child === null) return ""
  if (typeof child === "object") return escapeHTML(JSON.stringify(child))
  return escapeHTML(String(child))
}

function renderProps(props: MatraProps, options: HTMLOptions): string {
  return Object.entries(props)
    .filter(([, value]) => value !== null && value !== false)
    .map(([key, value]) => {
      if (isMatraAST(value)) {
        throw new TypeError(`Unresolved expression in HTML attribute: ${key}`)
      }
      if (value === true) return ` ${key}`
      const serialized = prefixBasePath(
        key,
        Array.isArray(value) ? value.join(" ") : String(value),
        options.basePath,
      )
      return ` ${key}="${escapeAttribute(serialized)}"`
    })
    .join("")
}

function prefixBasePath(key: string, value: string, basePath?: string): string {
  if ((key !== "href" && key !== "src") || !basePath || !value.startsWith("/") || value.startsWith("//")) {
    return value
  }
  const normalized = basePath.replace(/^\/+|\/+$/g, "")
  return normalized ? `/${normalized}${value}` : value
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
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "tag" in value &&
    typeof value.tag === "string" &&
    "props" in value &&
    value.props !== null &&
    typeof value.props === "object" &&
    !Array.isArray(value.props) &&
    "children" in value &&
    Array.isArray(value.children)
  )
}

export default { toHTML }
