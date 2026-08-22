# grammar

```page.matra
html[lang="ja"] {
  head {
    meta[charset="UTF-8"];
    title {
      "Grammar — Matra Specification v0.2"
    }
    link[rel="stylesheet", href="/app.css"];
  }
  body {
    main {
      article.docs-content {
        p.eyebrow {
          "03 / SOURCE"
        }
        h1 {
          "Grammar"
        }
        p.lede {
          "標準の関数構文と、簡潔な文書構文を定義します。"
        }
        h2 {
          "Function syntax"
        }
        pre {
          code~section(
  heading("Title"),
  paragraph("Body"),
  id="intro"
)~
        }
        h2 {
          "Document syntax"
        }
        pre {
          code~article.card#main {
  h1 { "Title" }
  p\`Body\`
}~
        }
        p.source-link {
          a[href="https://github.com/matralang/matra/blob/main/spec/grammar.ja.md"] {
            "完全な仕様をGitHubで読む →"
          }
        }
      }
    }
  }
}
```
