import { matra } from "../matra"
import defaultLayout from "../layouts/default-layout"

const page = defaultLayout(matra`
  section.hero {
    div.shell.hero-grid {
      div.hero-copy {
        p.eyebrow { "Matra Specification v0.1" }
        h1 { "意味より先に、構造を書く。" }
        p.lede {
          "Matraは、tag・props・childrenからなるツリーを記述するための、"
          "小さくドメイン非依存な言語です。"
        }
        div.actions {
          a.button.primary[href="/docs/"] { "仕様を読む" }
          a.button.secondary[href="https://github.com/matralang/matra"] { "ソースを見る" }
        }
      }
      div.code-window[aria-label="Matraコード例"] {
        div.window-bar {
          span {}
          span {}
          span {}
          small { "hello.matra" }
        }
        pre { code~group(
  item("one"),
  item("two"),
  role="list"
)~ }
        div.output {
          span { "AST" }
          code~{ tag, props, children }~
        }
      }
    }
  }
  section.principles {
    div.shell {
      p.eyebrow { "One language, many domains" }
      h2 { "構造は共通。意味は交換可能。" }
      div.card-grid {
        article.feature-card {
          span.card-number { "01" }
          h3 { "Domain neutral" }
          p { "HTML、数式、Graphics。tagの意味はrendererが決めます。" }
        }
        article.feature-card {
          span.card-number { "02" }
          h3 { "Two representations" }
          p { "交換用のMatraJSONと、操作しやすいobject形式ASTを往復できます。" }
        }
        article.feature-card {
          span.card-number { "03" }
          h3 { "Replaceable parser" }
          p { "parserは小さな契約。文法エンジンとdomain実装を切り離します。" }
        }
      }
    }
  }
  section.spec-callout {
    div.shell.callout-inner {
      div {
        p.eyebrow { "The foundation" }
        h2 { "4つの仕様から始める" }
      }
      ol.spec-mini-list {
        li { a[href="/docs/data-model/"] { span { "01" } strong { "Data Model" } } }
        li { a[href="/docs/ast/"] { span { "02" } strong { "AST" } } }
        li { a[href="/docs/grammar/"] { span { "03" } strong { "Grammar" } } }
        li { a[href="/docs/parser/"] { span { "04" } strong { "Parser" } } }
      }
    }
  }
`, {
  title: "Matra — Structure first. Domain later.",
  description: "Matraはtag・props・childrenからなるドメイン非依存のツリー記法です。",
})

export default page
