---
title: Math Notebook — Matra
description: Matra MathとCortex Compute Engineを対話的に試せる数式処理ノートブックです。
layout: site
---

```page.matra
section.math-notebook-page {
  header.shell.math-notebook-heading {
    div {
      p.eyebrow {
        "MATRA MATH / COMPUTE ENGINE"
      }
      h1 {
        "Math Notebook"
      }
      p.math-notebook-lede {
        "数式を入力し、記号的な変形と数値結果を並べて確認できます。"
      }
    }
    div.notebook-actions {
      button(id="run-all", type="button") {
        "Run All"
      }
      button(id="add-cell", type="button") {
        "Add Cell"
      }
    }
  }
  p.math-page-status(id="math-page-status", role="status", aria-live="polite") {
    "Ready"
  }
  div.math-notebook-layout {
    section.notebook-column(aria-label="Notebook") {
      div(id="notebook-cells") {
      }
    }
    aside.reference-dock(aria-label="Math reference") {
      div.reference-tabs(role="tablist", aria-label="Reference views") {
        button.reference-tab.active(id="reference-tab", type="button", role="tab", aria-selected="true", data-reference-panel="reference") {
          "Reference"
        }
        button.reference-tab(id="examples-tab", type="button", role="tab", aria-selected="false", data-reference-panel="examples") {
          "Examples"
        }
      }
      div.reference-panel.active(id="reference-panel", role="tabpanel", aria-labelledby="reference-tab") {
      }
      div.reference-panel(id="examples-panel", role="tabpanel", aria-labelledby="examples-tab", hidden="true") {
      }
    }
  }
  script(type="module", src="/assets/math-notebook.js") {
  }
}
```
