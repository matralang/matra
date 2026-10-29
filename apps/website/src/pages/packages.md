---
title: 公式パッケージ — Matra
description: Matraのparser、renderer、domain packageを一覧できます。
layout: site
---

```page.program.matra
let links = [
  {number: "01", href: "https://github.com/matralang/matra/tree/main/packages/core#readme", label: "@matra/core", detail: "AST、parser、visitor、transformer。実験的なNode.js 22/24 literate API（Wasm同梱、導入後Rust不要、sandboxなし）。"},
  {number: "02", href: "https://github.com/matralang/matra/tree/main/packages/command", label: "@matra/command", detail: "外部commandの計画、認可、構造化実行。"},
  {number: "03", href: "https://github.com/matralang/matra/tree/main/packages/html", label: "@matra/html", detail: "Matra ASTのHTML renderer。"},
  {number: "04", href: "https://github.com/matralang/matra/tree/main/packages/graphics", label: "@matra/graphics", detail: "Graphics domainの表現と描画。"}
]

fn card(link) {
  a.docs-card(href=link.href) {
    span { link.number }
    div {
      h2 { link.label }
      p { link.detail }
    }
  }
}

section.hero {
  div.shell {
    div.hero-copy {
      p.eyebrow { "PACKAGES" }
      h1 { "公式パッケージ" }
      p.lede { "Matraのparser、renderer、domain packageを一覧できます。" }
      div.docs-card-list { ...for link in links { card(link) } }
    }
  }
}
```
