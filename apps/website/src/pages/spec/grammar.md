---
title: Grammar — Matra Specification v0.2
description: Matraの標準構文。
layout: specification
---

```page.matra
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
    code[src="matra:function-syntax.matra"];
  }
  h2 {
    "Document syntax"
  }
  pre {
    code[src="matra:document-syntax.matra"];
  }
  p.source-link {
    a[href="https://github.com/matralang/matra/blob/main/spec/grammar.ja.md"] {
      "完全な仕様をGitHubで読む →"
    }
  }
}
```

```function-syntax.matra
section(
  heading("Title"),
  paragraph("Body"),
  id="intro"
)
```

```document-syntax.matra
article.card#main {
  h1 { "Title" }
  p`Body`
}
```
