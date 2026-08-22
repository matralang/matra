# index

```page.matra.ts
import { matra } from "@matra/core"

const sections = [
  ["data-model", "Data Model", "Matraが表現できる値と等価性。"],
  ["ast", "AST", "visitorとrendererが扱うメモリ内表現。"],
  ["grammar", "Grammar", "関数構文と文書構文の規則。"],
  ["parser", "Parser", "入力、出力、mode、errorの契約。"],
]
const quote = value => JSON.stringify(value)
const number = index => String(index + 1).padStart(2, "0")
const navigation = matra.raw(sections.map(([slug, label], index) => `
  a[href=${quote(`/spec/${slug}/`)}] { span { ${quote(number(index))} } ${quote(label)} }
`).join(""))
const cards = matra.raw(sections.map(([slug, label, detail], index) => `
  a.docs-card[href=${quote(`/spec/${slug}/`)}] {
    span { ${quote(number(index))} }
    div { h2 { ${quote(label)} } p { ${quote(detail)} } }
  }
`).join(""))

export default matra`
  html[lang="ja"] {
    head {
      meta[charset="UTF-8"];
      meta[name="viewport", content="width=device-width, initial-scale=1"];
      meta[name="description", content="Matra Specification v0.2 Index"];
      meta[name="theme-color", content="#101814"];
      title { "Index — Matra Specification v0.2" }
      link[rel="stylesheet", href="/app.css"];
    }
    body {
      main {
        div.shell.docs-shell {
          aside.docs-nav {
            p { "SPECIFICATION 0.2" }
            nav[aria-label="仕様書"] { ${navigation} }
          }
          article.docs-content {
            p.eyebrow { "MATRA SPECIFICATION" }
            h1 { "言語の最小契約" }
            p.lede { "v0.2は、ツリーを表現し、読み取り、交換するための4つの仕様を定義します。" }
            div.docs-card-list { ${cards} }
          }
        }
      }
    }
  }
`
```
