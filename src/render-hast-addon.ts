/**
 * Render HAST/MDAST-style node {type, tagName, properties, children}
 * @param {Object} node
 * @returns {string}
 */
export function renderHastNode(node) {
  // Text node
  if (node.type === "text") {
    return escapeHTML(node.value || "")
  }

  // Element node
  if (node.type === "element") {
    const tag = node.tagName || "div"
    const attrs = renderAttrs(node.properties || {})
    const isVoid = VOID_ELEMENTS.has(tag)

    if (isVoid) {
      return `<${tag}${attrs}>`
    }

    const children = (node.children || []).map(n => toHTML(n)).join("")
    return `<${tag}${attrs}>${children}</${tag}>`
  }

  // Root node (fragment)
  if (node.type === "root") {
    return (node.children || []).map(n => toHTML(n)).join("")
  }

  // Unknown node type
  return ""
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr"
])

function renderAttrs(attrs) {
  if (!attrs || typeof attrs !== "object") return ""
  return Object.entries(attrs)
    .filter(([k, v]) => v != null)
    .map(([k, v]) => {
      if (typeof v === "boolean") return v ? ` ${k}` : ""
      return ` ${k}="${escapeAttr(String(v))}"`
    })
    .join("")
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function escapeAttr(str) {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#039;")
}

// Import from the compiled renderer module
import { toHTML } from "./render.js"
