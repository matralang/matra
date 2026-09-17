---
title: Parser — Matra Specification v0.2
description: Matra parserの契約。
layout: specification
---

```page.matra
article.docs-content {
  p.eyebrow {
    "04 / CONTRACT"
  }
  h1 {
    "Parser"
  }
  p.lede {
    "parserはMatra sourceを受け取り、data modelと等価なtreeを返します。"
  }
  h2 {
    "Minimal interface"
  }
  pre {
    code(src="matra:parser-signature.txt"){}
  }
  h2 {
    "Syntax modes"
  }
  table {
    thead {
      tr {
        th {
          "Mode"
        }
        th {
          "Accepted syntax"
        }
      }
    }
    tbody {
      tr {
        td {
          code {
            "mixed"
          }
        }
        td {
          "Function + document"
        }
      }
      tr {
        td {
          code {
            "document"
          }
        }
        td {
          "Document only"
        }
      }
      tr {
        td {
          code {
            "application"
          }
        }
        td {
          "Function only"
        }
      }
    }
  }
  p.source-link {
    a(href="https://github.com/matralang/matra/blob/main/spec/parser.ja.md") {
      "完全な仕様をGitHubで読む →"
    }
  }
}
```

```parser-signature.txt
parse(source, options?) → AST | MatraJSON
```
