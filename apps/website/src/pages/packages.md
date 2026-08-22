# packages

```page.matra.ts
const packages = [
  ["core", "@matra/core", "AST、parser、visitor、transformer。"],
  ["command", "@matra/command", "外部commandの計画、認可、構造化実行。"],
  ["html", "@matra/html", "Matra ASTのHTML renderer。"],
  ["graphics", "@matra/graphics", "Graphics domainの表現と描画。"],
]
const quote = value => JSON.stringify(value)
const cards = raw(packages.map(([name, label, detail], index) => `
  a.docs-card[href=${quote(`https://github.com/matralang/matra/tree/main/packages/${name}`)}] {
    span { ${quote(String(index + 1).padStart(2, "0"))} }
    div { h2 { ${quote(label)} } p { ${quote(detail)} } }
  }
`).join(""))

export default matra`
  html[lang="ja"] {
    head {
      meta[charset="UTF-8"];
      meta[name="viewport", content="width=device-width, initial-scale=1"];
      meta[name="description", content="Matraのparser、renderer、domain packageを一覧できます。"];
      meta[name="theme-color", content="#101814"];
      title { "公式パッケージ — Matra" }
      link[rel="stylesheet", href="/app.css"];
    }
    body {
      main {
        section.hero {
          div.shell {
            div.hero-copy {
              p.eyebrow { "PACKAGES" }
              h1 { "公式パッケージ" }
              p.lede { "Matraのparser、renderer、domain packageを一覧できます。" }
              div.docs-card-list { ${cards} }
            }
          }
        }
      }
    }
  }
`
```
