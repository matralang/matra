import { matra } from "../../matra"
import { docsLayout } from "./_layout"

export default docsLayout(matra`
  p.eyebrow { "01 / FOUNDATION" }
  h1 { "Data Model" }
  p.lede { "Matra文書は、tag・props・childrenを持つroot nodeを1つ表現します。" }
  h2 { "Node" }
  dl.definition-list {
    div { dt { "tag" } dd { "nodeを識別するstring" } }
    div { dt { "props" } dd { "string keyからJSON互換valueへのmap" } }
    div { dt { "children" } dd { "nodeまたはvalueの順序付きlist" } }
  }
  h2 { "MatraJSON" }
  p { "交換形式ではnodeを3要素のJSON配列で表します。" }
  pre { code~[tag, props, children]~ }
  p.source-link { a[href="https://github.com/matralang/matra/blob/main/spec/data-model.ja.md"] { "完全な仕様をGitHubで読む →" } }
`, "Data Model")
