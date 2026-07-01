/**
 * Matra評価関数
 * @param {any[]} node - Matrast構造
 * @param {object} env - 評価環境
 */
export function evaluate(node, env = {}) {
  if (Array.isArray(node[0])) {
    // Entry配列
    return node.map(n => evaluate(n, env))
  }
  const [tag, props, body] = node

  switch (tag) {
    case "code":
      return {
        type: "Code",
        lang: props?.fileType ?? null,
        content: body.join("\\n"),
      }
    case "h1":
    case "h2":
    case "p":
      return { type: "TextBlock", tag, text: body.join(" ") }
    case "tagdef":
      env[tag] = { props, body }
      return { type: "TagDef", name: props.name, fields: body }
    default:
      return { type: "Node", tag, props, body }
  }
}
