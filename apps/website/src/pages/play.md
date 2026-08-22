---
title: Playground — Matra
description: Markdown内のMatraとMatra TypeScript code blockをASTとrendererに応じた出力へ変換できるブラウザPlaygroundです。
layout: site
---

````page.matra
section.playground-page {
  div.shell.playground-heading {
    div {
      p.eyebrow {
        "LIVE WORKBENCH"
      }
      h1 {
        "Playground"
      }
    }
    p {
      "Markdown内のMatra code blockを編集すると、rendererに応じたpreview・AST・出力をその場で更新します。"
    }
  }
  div.playground-workspace {
    section.editor-panel[aria-label="Markdown editor"] {
      header.panel-header {
        div.panel-title {
          span.status-dot {
          }
          strong {
            "SOURCE"
          }
        }
        div.editor-tools {
          span {
            "Markdown / Matra"
          }
          label[for="render-mode"] {
            "Output"
          }
          select#render-mode {
            option[value="auto"] {
              "Auto"
            }
            option[value="html"] {
              "HTML"
            }
            option[value="svg"] {
              "SVG"
            }
          }
          label[for="stylesheet"] {
            "CSS"
          }
          input#stylesheet[list="stylesheet-presets", value="matra", spellcheck="false", aria-label="Preview stylesheet", placeholder="matra, water.css, or HTTPS URL"] {
          }
          datalist#stylesheet-presets {
            option[value="matra"] {
              "Matra Base"
            }
            option[value="water.css"] {
              "Water.css"
            }
            option[value="simple.css"] {
              "Simple.css"
            }
            option[value="pico.css"] {
              "Pico CSS"
            }
          }
        }
      }
      div.example-browser[aria-label="Examples"] {
        div.example-browser-heading {
          span {
            "EXAMPLES"
          }
          small {
            "Select a recipe to load it"
          }
        }
        div.example-list {
          button.example-button.active[type="button", data-example="card", aria-pressed="true"] {
            span.example-kind {
              "HTML"
            }
            strong {
              "Card"
            }
            small {
              "Content and link"
            }
          }
          button.example-button[type="button", data-example="list", aria-pressed="false"] {
            span.example-kind {
              "HTML"
            }
            strong {
              "Ordered list"
            }
            small {
              "Nested structure"
            }
          }
          button.example-button[type="button", data-example="profile", aria-pressed="false"] {
            span.example-kind {
              "HTML"
            }
            strong {
              "Profile"
            }
            small {
              "Semantic content"
            }
          }
          button.example-button[type="button", data-example="navigation", aria-pressed="false"] {
            span.example-kind {
              "HTML"
            }
            strong {
              "Navigation"
            }
            small {
              "Links and attributes"
            }
          }
          button.example-button[type="button", data-example="article", aria-pressed="false"] {
            span.example-kind {
              "HTML"
            }
            strong {
              "Article"
            }
            small {
              "A complete document"
            }
          }
          button.example-button[type="button", data-example="poster", aria-pressed="false"] {
            span.example-kind.svg {
              "SVG"
            }
            strong {
              "Poster"
            }
            small {
              "Gradient and type"
            }
          }
          button.example-button[type="button", data-example="orbit", aria-pressed="false"] {
            span.example-kind.svg {
              "SVG"
            }
            strong {
              "Orbit"
            }
            small {
              "Shapes and strokes"
            }
          }
          button.example-button[type="button", data-example="landscape", aria-pressed="false"] {
            span.example-kind.svg {
              "SVG"
            }
            strong {
              "Landscape"
            }
            small {
              "Layered geometry"
            }
          }
          button.example-button[type="button", data-example="signal", aria-pressed="false"] {
            span.example-kind.svg {
              "SVG"
            }
            strong {
              "Signal"
            }
            small {
              "Lines and opacity"
            }
          }
          button.example-button[type="button", data-example="compute-engine", aria-pressed="false"] {
            span.example-kind.math {
              "MATH"
            }
            strong {
              "Compute Engine"
            }
            small {
              "Matra math input"
            }
          }
          button.example-button[type="button", data-example="js-card", aria-pressed="false"] {
            span.example-kind.js {
              "TS"
            }
            strong {
              "Dynamic card"
            }
            small {
              "Values with interpolation"
            }
          }
          button.example-button[type="button", data-example="js-graphics", aria-pressed="false"] {
            span.example-kind.js {
              "TS"
            }
            strong {
              "Generated SVG"
            }
            small {
              "Generate a Matra block"
            }
          }
        }
      }
      label.sr-only[for="matra-source"] {
        "Markdown source"
      }
      textarea#matra-source[spellcheck="false", aria-describedby="playground-status", src="matra:playground.md"];
      footer.editor-footer {
              span#playground-status[role="status", aria-live="polite"] {
                "Ready"
              }
              span#source-stats {
                "0 chars"
              }
            }
          }
          section.result-panel[aria-label="Playground result"] {
            div.result-tabs[role="tablist", aria-label="Output"] {
              button.result-tab.active#tab-preview[type="button", role="tab", aria-selected="true", data-panel="preview"] {
                "Preview"
              }
              button.result-tab#tab-ast[type="button", role="tab", aria-selected="false", data-panel="ast"] {
                "AST"
              }
              button.result-tab#tab-matra-json[type="button", role="tab", aria-selected="false", data-panel="matra-json"] {
                "MatraJSON"
              }
              button.result-tab#tab-output[type="button", role="tab", aria-selected="false", data-panel="output"] {
                "Output"
              }
              button.copy-button#download-output[type="button"] {
                "Download"
              }
              button.copy-button#copy-output[type="button"] {
                "Copy"
              }
            }
            div.result-body {
              div.result-view.active#panel-preview[role="tabpanel", aria-labelledby="tab-preview"] {
                iframe#preview-frame[title="Rendered Matra preview", sandbox=""];
              }
              pre.result-view#panel-ast[role="tabpanel", aria-labelledby="tab-ast"] {
                code#ast-output {
                }
              }
              pre.result-view#panel-matra-json[role="tabpanel", aria-labelledby="tab-matra-json"] {
                code#matra-json-output {
                }
              }
              pre.result-view#panel-output[role="tabpanel", aria-labelledby="tab-output"] {
                code#renderer-output {
                }
              }
              div.error-card#playground-error[hidden="true"] {
                strong {
                  "Parse error"
                }
                pre#playground-error-message {
                }
              }
            }
          }
        }
      }
      script[type="module", src="/assets/playground.js"] {
      }
````

````playground.md
# Card

```card.matra
article.matra-frame {
  p.eyebrow { "MATRA" }
  h2 { "Structure first." }
  p { "Edit this source and watch it render." }
  a.matra-button[href="/spec/"] { "Read the spec" }
  hr;
}
```
````
