import { sectionPage } from "./_section"

export default sectionPage(
  "DOCUMENTATION",
  "Matraを使う",
  "言語仕様、Playground、作例、パッケージへの入口です。",
  [
    { href: "/spec/", label: "Language Specification", detail: "言語のデータモデル、AST、文法、parser契約。" },
    { href: "/play/", label: "Playground", detail: "Matra sourceをブラウザで試す。" },
    { href: "/examples/", label: "Examples", detail: "分野ごとの利用例を見る。" },
    { href: "/packages/", label: "Packages", detail: "公式パッケージとAPIを探す。" },
  ],
)
