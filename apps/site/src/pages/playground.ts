import { matra } from "../matra"
import defaultLayout from "../layouts/default-layout"

export default defaultLayout(matra`
  section.playground-page {
    div.shell.playground-heading {
      div {
        p.eyebrow { "LIVE WORKBENCH" }
        h1 { "Playground" }
      }
      p { "Matra sourceを編集すると、AST・HTML・previewをその場で更新します。" }
    }
    div.playground-workspace {
      section.editor-panel[aria-label="Matra editor"] {
        header.panel-header {
          div.panel-title { span.status-dot {} strong { "SOURCE" } }
          div.editor-tools {
            label[for="syntax-mode"] { "Mode" }
            select#syntax-mode {
              option[value="mixed"] { "mixed" }
              option[value="document"] { "document" }
              option[value="application"] { "application" }
            }
          }
        }
        div.example-bar[aria-label="Examples"] {
          button.example-button[type="button" data-example="card"] { "Card" }
          button.example-button[type="button" data-example="list"] { "List" }
          button.example-button[type="button" data-example="function"] { "Function" }
        }
        label.sr-only[for="matra-source"] { "Matra source" }
        textarea#matra-source[spellcheck="false" aria-describedby="playground-status"]~article.card {
  p.eyebrow\`MATRA / HTML\`
  h2\`Structure first.\`
  p\`Edit this source and watch it render.\`
  a.button.primary[href="/docs/"] \`Read the spec\`
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
          button.result-tab#tab-html[type="button" role="tab" aria-selected="false" data-panel="html"] { "HTML" }
          button.copy-button#copy-output[type="button"] { "Copy" }
        }
        div.result-body {
          div.result-view.active#panel-preview[role="tabpanel" aria-labelledby="tab-preview"] {
            iframe#preview-frame[title="Rendered Matra preview" sandbox=""]
          }
          pre.result-view#panel-ast[role="tabpanel" aria-labelledby="tab-ast"] { code#ast-output {} }
          pre.result-view#panel-html[role="tabpanel" aria-labelledby="tab-html"] { code#html-output {} }
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
  description: "Matra sourceをASTとHTMLへ変換できるブラウザPlaygroundです。",
})
