import { toHtml } from "hast-util-to-html"
import { parse } from "./matra-parser.mjs"

function toAst(html: string) {
  const parsed = parse(html.trim())
  return parsed
}

const t = (s: string) => JSON.stringify(s)

const escAttr = (s: string) =>
  s.replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;")
   .replace(/'/g, "&#39;")

const a = (s: string) => escAttr(s)

const $m = (strings: TemplateStringsArray | string[], ...values: any[]) => {
  let result = ""
  for (let i = 0; i < strings.length; i++) {
    result += strings[i]
    if (i < values.length) {
      result += values[i]
    }
  }
  return result
}

export { t, a, toAst, toHtml, $m }
