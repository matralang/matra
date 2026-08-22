---
title: Data Model — Matra Specification v0.2
description: Matraのデータモデル。
layout: specification
---

```page.matra
article.docs-content {
  p.eyebrow {
    "01 / FOUNDATION"
  }
  h1 {
    "Data Model"
  }
  p.lede {
    "Matra文書は、tag・props・childrenを持つroot nodeを1つ表現します。"
  }
  h2 {
    "Node"
  }
  dl.definition-list {
    div {
      dt {
        "tag"
      }
      dd {
        "nodeを識別するstring"
      }
    }
    div {
      dt {
        "props"
      }
      dd {
        "string keyからJSON互換valueへのmap"
      }
    }
    div {
      dt {
        "children"
      }
      dd {
        "nodeまたはvalueの順序付きlist"
      }
    }
  }
  h2 {
    "MatraJSON"
  }
  p {
    "交換形式ではnodeを3要素のJSON配列で表します。"
  }
  pre {
    code[src="matra:matra-json.txt"];
  }
  p.source-link {
    a[href="https://github.com/matralang/matra/blob/main/spec/data-model.ja.md"] {
      "完全な仕様をGitHubで読む →"
    }
  }
}
```

```matra-json.txt
[tag, props, children]
```
