# docs

```page.matra.ts
import { matra } from "@matra/core"
import { docsCards } from "../components/cards"
import { pageLayout } from "../layouts/page"

const links = [
  { href: "/spec/", label: "Language Specification", detail: "言語のデータモデル、AST、文法、parser契約。" },
  { href: "/play/", label: "Playground", detail: "Matra sourceをブラウザで試す。" },
  { href: "/examples/", label: "Examples", detail: "分野ごとの利用例を見る。" },
  { href: "/packages/", label: "Packages", detail: "公式パッケージとAPIを探す。" },
]

export default pageLayout({
  title: "Matraを使う — Matra",
  description: "言語仕様、Playground、作例、パッケージへの入口です。",
  content: matra`
    section.hero {
      div.shell { div.hero-copy {
        p.eyebrow { "DOCUMENTATION" }
        h1 { "Matraを使う" }
        p.lede { "言語仕様、Playground、作例、パッケージへの入口です。" }
        div.docs-card-list { ${docsCards(links)} }
      } }
    }
  `,
})
```
