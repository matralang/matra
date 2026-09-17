---
title: AST — Matra Specification v0.2
description: ASTの表現形式と変換契約。
layout: specification
---

```page.matra
article.docs-content {
  p.eyebrow {
    "02 / REPRESENTATION"
  }
  h1 {
    "AST"
  }
  p.lede {
    "ASTはvisitor、transformer、rendererが扱うobject形式のメモリ内表現です。"
  }
  h2 {
    "Shape"
  }
  pre {
    code(src="matra:ast-shape.txt"){}
  }
  h2 {
    "Lossless conversion"
  }
  p {
    "ASTとMatraJSONの変換は再帰的で、tag、value、型、child順序を保持します。"
  }
  pre {
    code(src="matra:ast-conversion.txt"){}
  }
  p.source-link {
    a(href="https://github.com/matralang/matra/blob/main/spec/ast.ja.md") {
      "完全な仕様をGitHubで読む →"
    }
  }
}
```

```ast-shape.txt
{
  tag: string,
  props: Record,
  children: Array
}
```

```ast-conversion.txt
{ tag, props, children }
           ↕
[tag, props, children]
```
