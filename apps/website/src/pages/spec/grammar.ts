import { matra } from "../../matra"
import { docsLayout } from "./_layout"

export default docsLayout(matra`
  p.eyebrow { "03 / SOURCE" }
  h1 { "Grammar" }
  p.lede { "標準の関数構文と、簡潔な文書構文を定義します。" }
  h2 { "Function syntax" }
  pre { code~section(
  heading("Title"),
  paragraph("Body"),
  id="intro"
)~ }
  h2 { "Document syntax" }
  pre { code~article.card#main {
  h1 { "Title" }
  p\`Body\`
}~ }
  p.source-link { a[href="https://github.com/matralang/matra/blob/main/spec/grammar.ja.md"] { "完全な仕様をGitHubで読む →" } }
`, "Grammar")
