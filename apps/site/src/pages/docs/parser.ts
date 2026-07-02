import { matra } from "../../matra"
import { docsLayout } from "./_layout"

export default docsLayout(matra`
  p.eyebrow { "04 / CONTRACT" }
  h1 { "Parser" }
  p.lede { "parserはMatra sourceを受け取り、data modelと等価なtreeを返します。" }
  h2 { "Minimal interface" }
  pre { code~parse(source, options?) → AST | MatraJSON~ }
  h2 { "Syntax modes" }
  table {
    thead { tr { th { "Mode" } th { "Accepted syntax" } } }
    tbody {
      tr { td { code { "mixed" } } td { "Function + document" } }
      tr { td { code { "document" } } td { "Document only" } }
      tr { td { code { "application" } } td { "Function only" } }
    }
  }
  p.source-link { a[href="https://github.com/matralang/matra/blob/main/spec/parser.ja.md"] { "完全な仕様をGitHubで読む →" } }
`, "Parser")
