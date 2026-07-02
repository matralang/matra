import { $m } from "../../modules/matra"
import defaultLayout from "../layouts/default-layout"

const heroImage = $m`
  div.w-full.md:w-1/2.flex.justify-center {
    div.w-80.sm:w-96.h-56.sm:h-64.relative {
      div.absolute.-left-6.-top-6.w-60.h-40.bg-white/10.rounded-2xl.shadow-lg.transform.rotate-6 {}
      div.absolute.left-6.top-6.w-64.h-44.bg-white/20.rounded-2xl.shadow-2xl.transform.-rotate-3.flex.items-center.justify-center {
        svg.w-24.h-24.text-white/90[
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        ] {
          rect[x="3" y="3" width="18" height="14" rx="2" ry="2"]
          path[d="M7 21h10"]
          path[d="M7 7h10"]
          path[d="M12 3v18"]
        }
      }
    }
  }
`

const secHero = $m`
  section.relative.bg-gradient-to-r.from-blue-900.via-blue-600.to-sky-300.text-white.overflow-hidden {
    div.absolute.inset-0.pointer-events-none {
      svg.absolute.-left-24.-top-24.w-96.h-96.opacity-20[
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
      ] {
        defs {
          linearGradient#g[x1="0" x2="1"] {
            stop[offset="0" stop-color="#fff"]
            stop[offset="1" stop-color="#000"]
          }
        }
        circle[cx="100" cy="100" r="80" fill="url(#g)"]
      }
    }
    div.relative.max-w-7xl.mx-auto.px-6.py-20.md:py-28.flex.flex-col-reverse.md:flex-row.items-center.gap-12 {
      div.w-full.md:w-1/2 {
        h1.text-3xl.sm:text-4xl.md:text-5xl.font-extrabold.leading-tight {
          "クリエイティブを、もっと速く、もっと自由に"
        }
        p.mt-4.text-lg.sm:text-xl.max-w-xl.opacity-90 {
          "MatraMagicはテンプレート、エフェクト、コラボレーションを一つにまとめたクリエイティブツールです。"
          "アイデアをすばやく形にしましょう。"
        }
        div.mt-6.flex.flex-wrap.gap-3 {
          a.btn.px-5.py-3.bg-white.text-indigo-600.font-semibold.shadow.transform.hover:scale-105[
            href="#"
          ] {
            "今すぐはじめる"
          }
          a.btn.px-5.py-3.border.border-white/30.text-white.hover:bg-white/10[
            href="#"
          ] {
            "機能を見る"
          }
        }
      }
      ${heroImage}
    }
  }
`

const secLang = $m`
  section.bg-white.text-gray-800.py-20 {
    div.max-w-7xl.mx-auto.px-6 {
      div.grid.md:grid-cols-2.gap-12.items-center {
        div {
          h2.text-2xl.font-bold.mb-4 { "マトラ言語 — 表現に特化した専用記法" }
          p.text-lg.mb-4 {
            "マトラ言語はテンプレート記述とUI構築をシンプルにするための、特定の用途に特化したやさしい記法です。"
            "直感的な構文でコンポーネントを組み立て、拡張可能なレンダリングを実現します。"
          }
          ul.list-disc.pl-5.space-y-2 {
            li { "宣言的なテンプレート構文" }
            li { "型安全なデータバインディング（オプション）" }
            li { "プラグインで機能拡張可能" }
          }
          div.mt-6 {
            a.btn.px-4.py-2.bg-indigo-600.text-white[href="#"] {
              "マトラ言語を始める"
            }
          }
        }
        div {
          div.bg-gray-100.rounded-lg.p-4.shadow {
            pre.bg-transparent.text-sm.overflow-x-auto {
              "const greet = (name) => $page { div { \"こんにちは、\" name } }"
            }
          }
        }
      }
    }
  }
`

const secContact = $m`
  section.bg-gray-50.text-gray-900.py-20 {
    div.max-w-7xl.mx-auto.px-6 {
      h2.text-2xl.font-bold.mb-6 { "マトラ研究所 — 研究とコミュニティ" }
      div.grid.md:grid-cols-3.gap-6 {
        div.card {
          h3.card-title { "屋号" }
          p.card-content { "マトラ研究所" }
        }
        div.card {
          h3.card-title { "代表者" }
          p.card-content { "岩淵勇樹" }
        }
        div.card {
          h3.card-title { "所在地" }
          p.card-content { "福井県大野市" }
        }
      }
      div.mt-6 {
        h3.text-lg.font-semibold.mb-2 { "事業内容" }
        ul.list-disc.pl-5.space-y-1 {
          li { "ITサービス・ソフトウェア開発" }
          li { "技術書・技術記事執筆" }
          li { "技術コミュニティ運営" }
        }
      }
      div.mt-6.flex.items-center.gap-4 {
        a.btn.btn-primary.px-5.py-3.bg-indigo-600.text-white[
          href="mailto:butchiyu+matra@gmail.com"
        ] {
          "お問い合わせ（butchiyu+matra@gmail.com）"
        }
        a.btn.px-5.py-3.border.border-gray-300.text-gray-700.rounded-lg[
          href="#"
        ] {
          "詳細を見る"
        }
      }
    }
  }
`

const pageIndex = defaultLayout($m`
  div#app {
    ${secHero}
    ${secLang}
    ${secContact}
  }
`, {
  lang: "ja",
  title: "MatraMagic - クリエイティブツール",
  description: "MatraMagicは、クリエイティブなプロジェクトを支援するための多機能ツールです。"
})

export default pageIndex
