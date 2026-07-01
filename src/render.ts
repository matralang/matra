// render.ts — Matra v0.5 Renderer
// --------------------------------
// Converts evaluated Matra objects into external representations
// Supports: HTML, JSON, TeX (basic), ESTree stub

import { evaluateSource } from "./evaluate.js"

/**
 * Render HAST/MDAST-style node {type, tagName, properties, children}
 * @param {Object} node
 * @returns {string}
 */
function renderHastNode(node) {
  // Text node
  if (node.type === "text") {
    return escapeHTML(node.value || "")
  }

  // Comment node
  if (node.type === "comment") {
    return `<!--${node.value || ""}-->`
  }

  // Element node
  if (node.type === "element") {
    const tag = node.tagName || "div"
    const attrs = Object.entries(node.properties || {})
      .filter(([k, v]) => v != null)
      .map(([k, v]) => {
        if (typeof v === "boolean") return v ? ` ${k}` : ""
        return ` ${k}="${escapeAttr(String(v))}"`
      })
      .join("")
    
    const voidElements = new Set([
      "area", "base", "br", "col", "embed", "hr", "img", "input",
      "link", "meta", "param", "source", "track", "wbr"
    ])
    
    if (voidElements.has(tag)) {
      return `<${tag}${attrs}>`
    }

    const children = (node.children || []).map(toHTML).join("")
    return `<${tag}${attrs}>${children}</${tag}>`
  }

  // Root node (fragment)
  if (node.type === "root") {
    return (node.children || []).map(toHTML).join("")
  }

  // Unknown node type
  return ""
}

/**
 * @param {any} node
 * @param {{ minify?: boolean }} [_opts] Reserved for output formatting options
 * @returns {string}
 */
export function toHTML(node, _opts = {}) {
  if (node == null) return ""

  // Handle arrays (AST is an array of entries)
  if (Array.isArray(node)) {
    // Check if it's a Matrast node [tag, props, body]
    if (typeof node[0] === "string" && node.length <= 3) {
      return renderMatrastNode(node as [any, any, any])
    }
    // Otherwise it's an array of nodes
    return node.map(toHTML).join("")
  }

  // Handle HAST/MDAST-style objects with type property
  if (typeof node === "object" && node.type) {
    return renderHastNode(node)
  }

  if (typeof node !== "object") return escapeHTML(String(node))

  // Plain object or string
  return escapeHTML(JSON.stringify(node))
}

/**
 * Render a Matrast node [tag, props, body]
 */
function renderMatrastNode([tag, props, body]) {
  props = props || {}
  body = body || []

  // Special tags
  switch (tag) {
    case "code": {
      const lang = props.fileType || props.language || "text"
      const content = Array.isArray(body) ? body.join("\n") : String(body)
      return `<pre><code class="lang-${escapeAttr(lang)}">${escapeHTML(
        content
      )}</code></pre>`
    }
    case "a":
      return `<a href="${escapeAttr(props.href)}">${toHTML(body)}</a>`
    case "img":
      return `<img src="${escapeAttr(props.src)}" alt="${escapeAttr(
        props.alt || ""
      )}" />`
    case "tagdef":
      return `<!-- tagdef ${escapeHTML(props.name)} (${
        Array.isArray(body) ? body.length : 0
      } fields) -->`
    default: {
      // Regular HTML tags
      const inner = Array.isArray(body)
        ? body.map(toHTML).join("")
        : escapeHTML(String(body))
      const attrs = Object.entries(props)
        .filter(([k, v]) => v != null)
        .map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`)
        .join("")

      // Void elements
      const voidElements = new Set([
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
      ])
      if (voidElements.has(tag)) {
        return `<${tag}${attrs}>`
      }

      return `<${tag}${attrs}>${inner}</${tag}>`
    }
  }
}

/**
 * JSON出力
 * @param {any} node
 * @param {Object} [opts]
 * @param {boolean} [opts.pretty] - Pretty print JSON
 * @returns {string}
 */
export function toJSON(node: unknown, opts: { pretty?: boolean } = {}): string {
  return JSON.stringify(node, null, opts.pretty ? 2 : 0)
}

/**
 * TeX出力（強化版）
 * - Markdown/Matra対応
 * - コード、画像、リンクの最小表現をサポート
 */
export function toTeX(node) {
  if (node == null) return ""

  // Handle arrays
  if (Array.isArray(node)) {
    // Check if it's a Matrast node [tag, props, body]
    if (typeof node[0] === "string" && node.length <= 3) {
      const [tag, props = {}, body = []] = node

      switch (tag) {
        case "h1":
          return `\\section*{${
            Array.isArray(body) ? body.map(toTeX).join("") : body
          }}`
        case "h2":
          return `\\subsection*{${
            Array.isArray(body) ? body.map(toTeX).join("") : body
          }}`
        case "h3":
          return `\\subsubsection*{${
            Array.isArray(body) ? body.map(toTeX).join("") : body
          }}`
        case "p":
          return `${Array.isArray(body) ? body.map(toTeX).join("") : body}\n\n`
        case "code": {
          const content = Array.isArray(body) ? body.join("\n") : String(body)
          return `\\begin{verbatim}\n${content}\n\\end{verbatim}\n`
        }
        case "img":
          return `\\includegraphics[width=0.8\\linewidth]{${props.src}}\n`
        case "a":
          return `\\href{${props.href}}{${
            Array.isArray(body) ? body.map(toTeX).join("") : body
          }}`
        default:
          return Array.isArray(body) ? body.map(toTeX).join("") : ""
      }
    }
    // Array of nodes
    return node.map(toTeX).join("")
  }

  if (typeof node !== "object") return String(node)
  return ""
}

/**
 * ESTree出力
 * Matraノードを最小限のJavaScript式に変換
 */
export function toESTree(node) {
  if (node == null) return null
  if (typeof node !== "object") return { type: "Literal", value: node }

  // Handle arrays
  if (Array.isArray(node)) {
    // Check if it's a Matrast node [tag, props, body]
    if (typeof node[0] === "string" && node.length <= 3) {
      const [tag, props = {}, body = []] = node

      switch (tag) {
        case "code": {
          const content = Array.isArray(body) ? body.join("\n") : String(body)
          return {
            type: "Program",
            sourceType: "module",
            body: [
              {
                type: "ExpressionStatement",
                expression: {
                  type: "Literal",
                  value: content,
                },
              },
            ],
          }
        }

        case "p":
        case "h1":
        case "div":
          return {
            type: "CallExpression",
            callee: { type: "Identifier", name: tag },
            arguments: Array.isArray(body)
              ? body.map(toESTree)
              : [{ type: "Literal", value: body }],
          }

        case "tagdef":
          return {
            type: "VariableDeclaration",
            kind: "const",
            declarations: [
              {
                type: "VariableDeclarator",
                id: { type: "Identifier", name: props.name },
                init: {
                  type: "ObjectExpression",
                  properties: Array.isArray(body)
                    ? body.map(f => ({
                        type: "Property",
                        key: { type: "Identifier", name: f.key || "unknown" },
                        value: { type: "Literal", value: f.default },
                      }))
                    : [],
                },
              },
            ],
          }

        default:
          return {
            type: "ObjectExpression",
            properties: Object.entries(props).map(([k, v]) => ({
              type: "Property",
              key: { type: "Identifier", name: k },
              value: { type: "Literal", value: v },
            })),
          }
      }
    }
    // Array of nodes
    return {
      type: "ArrayExpression",
      elements: node.map(toESTree),
    }
  }

  return { type: "Literal", value: node }
}

/**
 * Canvas出力
 * Matra構造をHTML Canvas命令列に変換
 */
export function toCanvas(node, ctx = []) {
  if (node == null) return ctx

  if (typeof node !== "object") {
    ctx.push({ op: "text", text: String(node) })
    return ctx
  }

  // Handle arrays
  if (Array.isArray(node)) {
    // Check if it's a Matrast node [tag, props, body]
    if (typeof node[0] === "string" && node.length <= 3) {
      const [tag, props = {}, body = []] = node

      switch (tag) {
        case "circle":
          ctx.push({
            op: "circle",
            x: props.x || 0,
            y: props.y || 0,
            r: props.r || 10,
            color: props.color || "black",
          })
          break
        case "rect":
          ctx.push({
            op: "rect",
            x: props.x || 0,
            y: props.y || 0,
            w: props.w || 10,
            h: props.h || 10,
            color: props.color || "black",
          })
          break
        case "text":
          ctx.push({
            op: "text",
            x: props.x || 0,
            y: props.y || 0,
            text: Array.isArray(body) ? body.join("") : String(body),
            color: props.color || "black",
          })
          break
        default:
          if (Array.isArray(body)) {
            body.forEach(b => toCanvas(b, ctx))
          }
      }
    } else {
      // Array of nodes
      node.forEach(n => toCanvas(n, ctx))
    }
  }

  return ctx
}

/**
 * ASTをHTML出力までまとめて実行
 */
export function renderHTML(source) {
  const evaluated = evaluateSource(source)
  return evaluated.map(toHTML).join("\n")
}

/**
 * Helper
 */
function escapeHTML(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
function escapeAttr(s) {
  if (s == null) return ""
  return String(s).replace(/"/g, "&quot;")
}

// CLI mode
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const fs = await import("fs")
  const src = process.argv[2]
  if (!src) {
    console.error("Usage: node dist/render.js <file.matra>")
    process.exit(1)
  }
  const text = fs.readFileSync(src, "utf-8")
  const html = renderHTML(text)
  console.log(html)
}
