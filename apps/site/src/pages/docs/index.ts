import { matra } from "../../matra"
import { docsLayout } from "./_layout"

export default docsLayout(matra`
  p.eyebrow { "MATRA SPECIFICATION" }
  h1 { "言語の最小契約" }
  p.lede { "v0.1は、ツリーを表現し、読み取り、交換するための4つの仕様を定義します。" }
  div.docs-card-list {
    a.docs-card[href="/docs/data-model/"] { span { "01" } div { h2 { "Data Model" } p { "Matraが表現できる値と等価性。" } } }
    a.docs-card[href="/docs/ast/"] { span { "02" } div { h2 { "AST" } p { "visitorとrendererが扱うメモリ内表現。" } } }
    a.docs-card[href="/docs/grammar/"] { span { "03" } div { h2 { "Grammar" } p { "関数構文と文書構文の規則。" } } }
    a.docs-card[href="/docs/parser/"] { span { "04" } div { h2 { "Parser" } p { "入力、出力、mode、errorの契約。" } } }
  }
`, "Index")
