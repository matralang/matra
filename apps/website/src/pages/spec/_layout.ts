import { matra } from "../../matra"
import defaultLayout from "../../layouts/default-layout"

export const specNav = matra`
  aside.docs-nav {
    p { "SPECIFICATION 0.2" }
    nav[aria-label="仕様書"] {
      a[href="/spec/data-model/"] { span { "01" } "Data Model" }
      a[href="/spec/ast/"] { span { "02" } "AST" }
      a[href="/spec/grammar/"] { span { "03" } "Grammar" }
      a[href="/spec/parser/"] { span { "04" } "Parser" }
    }
  }
`

export function docsLayout(content: string, title: string): string {
  return defaultLayout(matra`
    div.shell.docs-shell {
      ${specNav}
      article.docs-content { ${content} }
    }
  `, {
    title: `${title} — Matra Specification v0.2`,
    description: `Matra Specification v0.2 ${title}`,
  })
}
