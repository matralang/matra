import { matra } from "../matra"
import defaultLayout from "../layouts/default-layout"

const page = defaultLayout(matra`
  section.examples-hero {
    div.shell.examples-hero-inner {
      div {
        p.eyebrow { "EXAMPLES" }
        h1 { "JavaScriptからMatraを使う。" }
        p.lede {
          "websiteの作例は、Matra sourceを単体で眺めるだけでなく、"
          "TypeScriptやJavaScriptからparse、変換、renderする入口として掲載します。"
        }
      }
      div.example-note {
        span { "TypeScript-first" }
        p { "プログラマブルな作例を増やせるように、コードはTypeScriptで書ける形を基本にします。" }
      }
    }
  }
  section.examples-section {
    div.shell {
      div.example-listing {
        article.example-row {
          div.example-meta {
            span.example-index { "01" }
            h2 { "HTMLを生成する" }
            p { "Matraのtag、props、childrenをHTML rendererへ渡す最小例です。" }
          }
          div.example-code-pair {
            div.code-window.example-code[aria-label="TypeScript HTML example"] {
              div.window-bar {
                span.window-label { "TS" }
                small { "render-html.ts" }
              }
              pre { code~import { parse } from "@matra/core"
import { toHTML } from "@matra/html"

const source = [
  'article(',
  '  h1("Hello Matra"),',
  '  p("Structure first.", class="lead")',
  ')',
].join("\\n")

const html = toHTML(parse(source))
console.log(html)~ }
            }
            div.code-window.example-code[aria-label="Matra HTML source"] {
              div.window-bar {
                span.window-label { "MATRA" }
                small { "article.matra" }
              }
              pre { code~article(
  h1("Hello Matra"),
  p("Structure first.", class="lead")
)~ }
            }
          }
        }
        article.example-row {
          div.example-meta {
            span.example-index { "02" }
            h2 { "SVGを描画する" }
            p { "Graphics packageはMatra sourceを直接SVGへcompileできます。" }
          }
          div.example-code-pair {
            div.code-window.example-code[aria-label="TypeScript SVG example"] {
              div.window-bar {
                span.window-label { "TS" }
                small { "render-svg.ts" }
              }
              pre { code~import { compile } from "@matra/graphics"

const source = [
  "svg(",
  '  rect(width=256, height=256, fill="#fbfaf5"),',
  '  circle(cx=128, cy=128, r=72, fill="#ff4d6d"),',
  "  width=256,",
  "  height=256",
  ")",
].join("\\n")

const svg = compile(source, { pretty: true })~ }
            }
            div.code-window.example-code[aria-label="Matra SVG source"] {
              div.window-bar {
                span.window-label { "MATRA" }
                small { "badge.matra" }
              }
              pre { code~svg(
  rect(width=256, height=256, fill="#fbfaf5"),
  circle(cx=128, cy=128, r=72, fill="#ff4d6d"),
  width=256,
  height=256
)~ }
            }
          }
        }
        article.example-row {
          div.example-meta {
            span.example-index { "03" }
            h2 { "ASTをプログラムで組み替える" }
            p { "CoreのASTは普通のTypeScript値として扱えます。domain固有の意味づけはrenderer側に残します。" }
          }
          div.example-code-pair {
            div.code-window.example-code[aria-label="TypeScript AST example"] {
              div.window-bar {
                span.window-label { "TS" }
                small { "transform.ts" }
              }
              pre { code~import { parse, transform } from "@matra/core"

const ast = parse([
  "menu(",
  '  item("Docs", href="/docs/"),',
  '  item("Playground", href="/play/")',
  ")",
].join("\\n"))

const normalized = transform(ast, node =>
  node.tag === "item"
    ? { ...node, tag: "a", props: { ...node.props, role: "menuitem" } }
    : node,
)~ }
            }
            div.code-window.example-code[aria-label="Matra menu source"] {
              div.window-bar {
                span.window-label { "MATRA" }
                small { "menu.matra" }
              }
              pre { code~menu(
  item("Docs", href="/docs/"),
  item("Playground", href="/play/")
)~ }
            }
          }
        }
      }
    }
  }
`, {
  title: "Examples — Matra",
  description: "MatraをJavaScript / TypeScriptから扱う作例集です。",
})

export default page
