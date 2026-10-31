import MarkdownIt from "markdown-it"

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false })
const BLOCK_TAGS = {
  blockquote_open: "blockquote",
  bullet_list_open: "ul",
  heading_open: token => token.tag,
  list_item_open: "li",
  ordered_list_open: "ol",
  paragraph_open: "p",
  table_open: "table",
  thead_open: "thead",
  tbody_open: "tbody",
  tr_open: "tr",
  th_open: "th",
  td_open: "td",
}
const INLINE_TAGS = {
  em_open: "em",
  link_open: "a",
  s_open: "del",
  strong_open: "strong",
}

export function markdownToNodes(source, { resolveLink = value => value } = {}) {
  const tokens = markdown.parse(source, {})
  const root = { tag: "$root", props: {}, children: [] }
  const stack = [root]
  for (const token of tokens) {
    if (token.type.endsWith("_open")) {
      if (token.hidden) continue
      const tag = BLOCK_TAGS[token.type]
      if (!tag) continue
      const node = { tag: typeof tag === "function" ? tag(token) : tag, props: {}, children: [] }
      if (token.type === "ordered_list_open" && token.attrGet("start")) {
        node.props.start = Number(token.attrGet("start"))
      }
      stack.at(-1).children.push(node)
      stack.push(node)
    } else if (token.type.endsWith("_close")) {
      if (token.hidden) continue
      if (BLOCK_TAGS[token.type.replace("_close", "_open")]) stack.pop()
    } else if (token.type === "inline") {
      stack.at(-1).children.push(...inlineNodes(token.children ?? [], resolveLink))
    } else if (token.type === "fence" || token.type === "code_block") {
      const codeProps = {}
      const language = token.info.trim().split(/\s+/, 1)[0]
      if (/^[A-Za-z0-9_-]+$/.test(language)) codeProps.class = `language-${language}`
      stack.at(-1).children.push({
        tag: "pre",
        props: {},
        children: [{ tag: "code", props: codeProps, children: [token.content] }],
      })
    } else if (token.type === "hr") {
      stack.at(-1).children.push({ tag: "hr", props: {}, children: [] })
    } else if (token.type === "html_block") {
      if (token.content) stack.at(-1).children.push(token.content)
    }
  }
  return root.children
}

function inlineNodes(tokens, resolveLink) {
  const root = { tag: "$root", props: {}, children: [] }
  const stack = [root]
  for (const token of tokens) {
    if (token.type.endsWith("_open")) {
      const tag = INLINE_TAGS[token.type]
      if (!tag) continue
      const props = Object.fromEntries(token.attrs ?? [])
      if (tag === "a" && props.href) props.href = resolveLink(props.href, "link")
      const node = { tag, props, children: [] }
      stack.at(-1).children.push(node)
      stack.push(node)
    } else if (token.type.endsWith("_close")) {
      if (INLINE_TAGS[token.type.replace("_close", "_open")]) stack.pop()
    } else if (token.type === "image") {
      const props = Object.fromEntries(token.attrs ?? [])
      if (props.src) props.src = resolveLink(props.src, "image")
      props.alt = token.content
      if (token.attrGet("title")) props.title = token.attrGet("title")
      stack.at(-1).children.push({ tag: "img", props, children: [] })
    } else if (token.type === "code_inline") {
      stack.at(-1).children.push({ tag: "code", props: {}, children: [token.content] })
    } else if (token.type === "hardbreak") {
      stack.at(-1).children.push({ tag: "br", props: {}, children: [] })
    } else if (token.type === "softbreak") {
      stack.at(-1).children.push(" ")
    } else if (token.type === "text" || token.type === "html_inline") {
      if (token.content) stack.at(-1).children.push(token.content)
    } else if (token.content) {
      stack.at(-1).children.push(token.content)
    }
  }
  return root.children
}
