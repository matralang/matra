---
title: Matraを使う — Matra
description: 言語仕様、Playground、作例、パッケージへの入口です。
layout: site
---

```page.program.matra
let links = [
  {number: "01", href: "/spec/", label: "Language Specification", detail: "言語のデータモデル、AST、文法、parser契約。"},
  {number: "02", href: "/play/", label: "Playground", detail: "Matra sourceをブラウザで試す。"},
  {number: "03", href: "/examples/", label: "Examples", detail: "分野ごとの利用例を見る。"},
  {number: "04", href: "/packages/", label: "Packages", detail: "公式パッケージとAPIを探す。"}
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
      p.eyebrow { "DOCUMENTATION" }
      h1 { "Matraを使う" }
      p.lede { "言語仕様、Playground、作例、パッケージへの入口です。" }
      div.docs-card-list { ...for link in links { card(link) } }
    }
  }
}
```
