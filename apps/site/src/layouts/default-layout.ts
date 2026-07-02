import { t, a, $m } from "../../modules/matra"

const defaultTitle = "MatraMagic - クリエイティブツール"
const defaultDescription = "MatraMagicは、クリエイティブなプロジェクトを支援するための多機能ツールです。"
const ogImageUrl = "https://example.com/og-image.png"

const nav = $m`
  nav.bg-white.shadow {
    div.max-w-7xl.mx-auto.px-6.py-4.flex.justify-between.items-center {
      a.text-xl.font-bold[href="#"] { "MatraMagic" }
      div.space-x-4 {
        a.nav-link[href="/"] { "ホーム" }
        a.nav-link[href="/about/"] { "事業" }
        a.nav-link[href="/products/"] { "製品" }
        a.nav-link[href="/docs/"] { "ドキュメント" }
        a.nav-link[href="/contact/"] { "お問い合わせ" }
      }
    }
  }
`

const footer = $m`
  footer.bg-gray-800.text-white.py-6.mt-20 {
    div.max-w-7xl.mx-auto.px-6.text-center.text-sm.opacity-70 {
      "© 2026 マトラ研究所"
    }
  }
`

const defaultLayout = (content: string, { lang = "en", title = defaultTitle, description = defaultDescription } = {}) => $m`
  html[lang="${lang}"] {
    head {
      title { ${t(title)} }
      meta[charset="UTF-8"]
      meta[name="viewport" content="width=device-width, initial-scale=1.0"]
      meta[name="description" content="${a(description)}"]
      meta[name="author" content="IWABUCHI Yuki butchi"]
      meta[property="og:title" content="${a(title)}"]
      meta[property="og:description" content="${a(description)}"]
      meta[property="og:type" content="website"]
      meta[property="og:image" content="${ogImageUrl}"]
      meta[name="twitter:title" content="${a(title)}"]
      meta[name="twitter:description" content="${a(description)}"]
      meta[name="twitter:image" content="${ogImageUrl}"]
      meta[name="twitter:card" content="summary_large_image"]
      link[rel="stylesheet" href="/app.css"]
    }
    body {
      ${nav}
      ${content}
      ${footer}
    }
  }
`

export default defaultLayout
