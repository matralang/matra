import { matra } from "../../matra"
import { docsLayout } from "./_layout"

export default docsLayout(matra`
  p.eyebrow { "02 / REPRESENTATION" }
  h1 { "AST" }
  p.lede { "ASTはvisitor、transformer、rendererが扱うobject形式のメモリ内表現です。" }
  h2 { "Shape" }
  pre { code~{
  tag: string,
  props: Record,
  children: Array
}~ }
  h2 { "Lossless conversion" }
  p { "ASTとMatraJSONの変換は再帰的で、tag、value、型、child順序を保持します。" }
  pre { code~{ tag, props, children }
          ↕
[tag, props, children]~ }
  p.source-link { a[href="https://github.com/matralang/matra/blob/main/spec/ast.ja.md"] { "完全な仕様をGitHubで読む →" } }
`, "AST")
