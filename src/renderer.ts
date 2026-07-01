export function render(ast, type = "json") {
  switch (type) {
    case "json":
      return JSON.stringify(ast, null, 2)
    case "html":
      return toHTML(ast)
    default:
      throw new Error(`Unknown output type: ${type}`)
  }
}

function toHTML(ast) {
  if (Array.isArray(ast)) return ast.map(toHTML).join("")
  if (typeof ast === "object" && ast.tag) {
    const { tag, props, body } = ast
    const attrs = props
      ? " " +
        Object.entries(props)
          .map(([k, v]) => `${k}=\"${v}\"`)
          .join(" ")
      : ""
    const inner = Array.isArray(body) ? body.map(toHTML).join("") : body ?? ""
    return `<${tag}${attrs}>${inner}</${tag}>`
  }
  return String(ast)
}
