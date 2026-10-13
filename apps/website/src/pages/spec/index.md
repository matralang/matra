---
title: Matra Specification v0.2
description: Matraのデータモデル、AST、文法、parserを定義する言語仕様です。
layout: specification
---

```page.program.matra
let links = [
  {number: "01", href: "/spec/data-model/", label: "Data Model", detail: "Matraが表現できる値と等価性。"},
  {number: "02", href: "/spec/ast/", label: "AST", detail: "visitorとrendererが扱うメモリ内表現。"},
  {number: "03", href: "/spec/grammar/", label: "Grammar", detail: "関数構文と文書構文の規則。"},
  {number: "04", href: "/spec/parser/", label: "Parser", detail: "入力、出力、mode、errorの契約。"}
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

div.shell.docs-shell {
  aside.docs-nav {
    p { "SPECIFICATION 0.2" }
    nav(aria-label="仕様書") {
      ...for link in links {
        a(href=link.href) { span { link.number }; link.label }
      }
    }
  }
  article.docs-content {
    p.eyebrow { "MATRA SPECIFICATION" }
    h1 { "言語の最小契約" }
    p.lede { "v0.2は、ツリーを表現し、読み取り、交換するための4つの仕様を定義します。" }
    div.docs-card-list { ...for link in links { card(link) } }
  }
}
```
