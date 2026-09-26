---
title: Grammar — Matra Unified Grammar v0.3
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
    "関数呼び出しと、body を持つノード構築を区別する統一文法 v0.3 です。"
  }
  h2 {
    "Function syntax"
  }
  pre {
    code(src="matra:function-syntax.matra"){}
  }
  h2 {
    "Document syntax"
  }
  pre {
    code(src="matra:document-syntax.matra"){}
  }
  p.source-link {
    a(href="https://github.com/matralang/matra/blob/main/spec/unified-grammar.ja.md") {
      "完全な仕様をGitHubで読む →"
    }
  }
}
```

```function-syntax.matra
fn heading(text) { h1 { text } }
section(id="intro") {
  heading("Title")
  p { "Body" }
}
```

```document-syntax.matra
article.card(id="main") {
  h1 { "Title" }
  p { "Body" }
}
```
