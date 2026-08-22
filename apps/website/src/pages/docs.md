# docs

```page.matra.ts
const links = [
  ["/spec/", "Language Specification", "言語のデータモデル、AST、文法、parser契約。"],
  ["/play/", "Playground", "Matra sourceをブラウザで試す。"],
  ["/examples/", "Examples", "分野ごとの利用例を見る。"],
  ["/packages/", "Packages", "公式パッケージとAPIを探す。"],
]
const quote = value => JSON.stringify(value)
const cards = raw(links.map(([href, label, detail], index) => `
  a.docs-card[href=${quote(href)}] {
    span { ${quote(String(index + 1).padStart(2, "0"))} }
    div { h2 { ${quote(label)} } p { ${quote(detail)} } }
  }
`).join(""))

matra {
  html[lang="ja"] {
    head {
      meta[charset="UTF-8"];
      meta[name="viewport", content="width=device-width, initial-scale=1"];
      meta[name="description", content="言語仕様、Playground、作例、パッケージへの入口です。"];
      meta[name="theme-color", content="#101814"];
      title { "Matraを使う — Matra" }
      link[rel="stylesheet", href="/app.css"];
    }
    body {
      main {
        section.hero {
          div.shell {
            div.hero-copy {
              p.eyebrow { "DOCUMENTATION" }
              h1 { "Matraを使う" }
              p.lede { "言語仕様、Playground、作例、パッケージへの入口です。" }
              div.docs-card-list { ${cards} }
            }
          }
        }
      }
    }
  }
}
```
