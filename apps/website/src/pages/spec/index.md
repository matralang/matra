# index

```page.matra
html[lang="ja"] {
  head {
    meta[charset="UTF-8"];
    meta[name="viewport", content="width=device-width, initial-scale=1"];
    meta[name="description", content="Matra Specification v0.2 Index"];
    meta[name="theme-color", content="#101814"];
    title {
      "Index — Matra Specification v0.2"
    }
    link[rel="stylesheet", href="/app.css"];
  }
  body {
    main {
      div.shell.docs-shell {
        aside.docs-nav {
          p {
            "SPECIFICATION 0.2"
          }
          nav[aria-label="仕様書"] {
            a[href="/spec/data-model/"] {
              span {
                "01"
              }
              "Data Model"
            }
            a[href="/spec/ast/"] {
              span {
                "02"
              }
              "AST"
            }
            a[href="/spec/grammar/"] {
              span {
                "03"
              }
              "Grammar"
            }
            a[href="/spec/parser/"] {
              span {
                "04"
              }
              "Parser"
            }
          }
        }
        article.docs-content {
          p.eyebrow {
            "MATRA SPECIFICATION"
          }
          h1 {
            "言語の最小契約"
          }
          p.lede {
            "v0.2は、ツリーを表現し、読み取り、交換するための4つの仕様を定義します。"
          }
          div.docs-card-list {
            a.docs-card[href="/spec/data-model/"] {
              span {
                "01"
              }
              div {
                h2 {
                  "Data Model"
                }
                p {
                  "Matraが表現できる値と等価性。"
                }
              }
            }
            a.docs-card[href="/spec/ast/"] {
              span {
                "02"
              }
              div {
                h2 {
                  "AST"
                }
                p {
                  "visitorとrendererが扱うメモリ内表現。"
                }
              }
            }
            a.docs-card[href="/spec/grammar/"] {
              span {
                "03"
              }
              div {
                h2 {
                  "Grammar"
                }
                p {
                  "関数構文と文書構文の規則。"
                }
              }
            }
            a.docs-card[href="/spec/parser/"] {
              span {
                "04"
              }
              div {
                h2 {
                  "Parser"
                }
                p {
                  "入力、出力、mode、errorの契約。"
                }
              }
            }
          }
        }
      }
    }
  }
}
```
