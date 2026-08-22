import { matra } from "../matra"
import defaultLayout from "../layouts/default-layout"

export default defaultLayout(matra`
  section.playground-page {
    div.shell.playground-heading {
      div {
        p.eyebrow { "LIVE WORKBENCH" }
        h1 { "Playground" }
      }
      p { "Matra sourceを編集すると、HTMLまたはSVGのpreview・AST・出力をその場で更新します。" }
    }
    div.playground-workspace {
      section.editor-panel[aria-label="Matra editor"] {
        header.panel-header {
          div.panel-title { span.status-dot {} strong { "SOURCE" } }
          div.editor-tools {
            label[for="source-language"] { "Language" }
            select#source-language {
              option[value="matra"] { "Matra" }
              option[value="javascript"] { "JavaScript / TypeScript" }
              option[value="math"] { "Math" }
            }
            label[for="render-mode"] { "Output" }
            select#render-mode {
              option[value="auto"] { "Auto" }
              option[value="html"] { "HTML" }
              option[value="svg"] { "SVG" }
            }
          }
        }
        div.example-browser[aria-label="Examples"] {
          div.example-browser-heading {
            span { "EXAMPLES" }
            small { "Select a recipe to load it" }
          }
          div.example-list {
            button.example-button.active[type="button" data-example="card" aria-pressed="true"] {
              span.example-kind { "HTML" } strong { "Card" } small { "Content and link" }
            }
            button.example-button[type="button" data-example="list" aria-pressed="false"] {
              span.example-kind { "HTML" } strong { "Ordered list" } small { "Nested structure" }
            }
            button.example-button[type="button" data-example="profile" aria-pressed="false"] {
              span.example-kind { "HTML" } strong { "Profile" } small { "Semantic content" }
            }
            button.example-button[type="button" data-example="navigation" aria-pressed="false"] {
              span.example-kind { "HTML" } strong { "Navigation" } small { "Links and attributes" }
            }
            button.example-button[type="button" data-example="article" aria-pressed="false"] {
              span.example-kind { "HTML" } strong { "Article" } small { "A complete document" }
            }
            button.example-button[type="button" data-example="poster" aria-pressed="false"] {
              span.example-kind.svg { "SVG" } strong { "Poster" } small { "Gradient and type" }
            }
            button.example-button[type="button" data-example="orbit" aria-pressed="false"] {
              span.example-kind.svg { "SVG" } strong { "Orbit" } small { "Shapes and strokes" }
            }
            button.example-button[type="button" data-example="landscape" aria-pressed="false"] {
              span.example-kind.svg { "SVG" } strong { "Landscape" } small { "Layered geometry" }
            }
            button.example-button[type="button" data-example="signal" aria-pressed="false"] {
              span.example-kind.svg { "SVG" } strong { "Signal" } small { "Lines and opacity" }
            }
            button.example-button[type="button" data-example="compute-engine" data-language="math" aria-pressed="false"] {
              span.example-kind.math { "MATH" } strong { "Compute Engine" } small { "Matra math input" }
            }
            button.example-button[type="button" data-example="js-card" data-language="javascript" aria-pressed="false"] {
              span.example-kind.js { "JS / TS" } strong { "HTML API" } small { "Build from a template" }
            }
            button.example-button[type="button" data-example="js-graphics" data-language="javascript" aria-pressed="false"] {
              span.example-kind.js { "JS / TS" } strong { "Graphics API" } small { "Generate SVG" }
            }
          }
        }
        label.sr-only[for="matra-source"] { "Matra source" }
        textarea#matra-source[spellcheck="false" aria-describedby="playground-status"]~article.card {
  p.eyebrow\`MATRA / HTML\`
  h2\`Structure first.\`
  p\`Edit this source and watch it render.\`
  a.button.primary[href="/spec/"] \`Read the spec\`
  hr;
}~
        footer.editor-footer {
          span#playground-status[role="status" aria-live="polite"] { "Ready" }
          span#source-stats { "0 chars" }
        }
      }
      section.result-panel[aria-label="Playground result"] {
        div.result-tabs[role="tablist" aria-label="Output"] {
          button.result-tab.active#tab-preview[type="button" role="tab" aria-selected="true" data-panel="preview"] { "Preview" }
          button.result-tab#tab-ast[type="button" role="tab" aria-selected="false" data-panel="ast"] { "AST" }
          button.result-tab#tab-matra-json[type="button" role="tab" aria-selected="false" data-panel="matra-json"] { "MatraJSON" }
          button.result-tab#tab-math[type="button" role="tab" aria-selected="false" data-panel="math"] { "Math" }
          button.result-tab#tab-html[type="button" role="tab" aria-selected="false" data-panel="html"] { "HTML" }
          button.result-tab#tab-svg[type="button" role="tab" aria-selected="false" data-panel="svg"] { "SVG" }
          button.copy-button#download-output[type="button"] { "Download" }
          button.copy-button#copy-output[type="button"] { "Copy" }
        }
        div.result-body {
          div.result-view.active#panel-preview[role="tabpanel" aria-labelledby="tab-preview"] {
            iframe#preview-frame[title="Rendered Matra preview" sandbox=""];
          }
          pre.result-view#panel-ast[role="tabpanel" aria-labelledby="tab-ast"] { code#ast-output {} }
          pre.result-view#panel-matra-json[role="tabpanel" aria-labelledby="tab-matra-json"] { code#matra-json-output {} }
          pre.result-view#panel-math[role="tabpanel" aria-labelledby="tab-math"] { code#math-output {} }
          pre.result-view#panel-html[role="tabpanel" aria-labelledby="tab-html"] { code#html-output {} }
          pre.result-view#panel-svg[role="tabpanel" aria-labelledby="tab-svg"] { code#svg-output {} }
          div.error-card#playground-error[hidden="true"] {
            strong { "Parse error" }
            pre#playground-error-message {}
          }
        }
      }
    }
  }
  script[type="module" src="/assets/playground.js"] {}
`, {
  title: "Playground — Matra",
  description: "Matra sourceやJavaScript・TypeScript互換コードをAST、HTML、SVGへ変換できるブラウザPlaygroundです。",
})
