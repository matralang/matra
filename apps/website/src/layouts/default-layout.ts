import { matra, text } from "../matra"

interface LayoutOptions {
  title?: string
  description?: string
  lang?: "ja" | "en"
}

const nav = matra`
  header.site-header {
    div.shell.nav-shell {
      a.brand[href="/"] {
        span.brand-mark { "M" }
        span { "Matra" }
      }
      nav.site-nav[aria-label="メインナビゲーション"] {
        a[href="/docs/"] { "Docs" }
        a[href="/spec/"] { "Specification" }
        a[href="/play/"] { "Playground" }
        a[href="https://github.com/matralang/matra"] { "GitHub" }
      }
    }
  }
`

const footer = matra`
  footer.site-footer {
    div.shell.footer-grid {
      div {
        strong { "Matra" }
        p { "Structure first. Domain later." }
      }
      p { "Matra Specification v0.2" }
    }
  }
`

const googleTagManagerHead = matra`
  script {
    "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T8JD7GH9');"
  }
`

const googleTagManagerBody = matra`
  noscript {
    iframe[src="https://www.googletagmanager.com/ns.html?id=GTM-T8JD7GH9", height="0", width="0", style="display:none;visibility:hidden"] {}
  }
`

export default function defaultLayout(
  content: string,
  {
    title = "Matra — Domain-neutral tree notation",
    description = "Matraはドメイン非依存のツリー記法です。",
    lang = "ja",
  }: LayoutOptions = {},
): string {
  return matra`
    html[lang="${lang}"] {
      head {
        meta[charset="UTF-8"];
        meta[name="viewport", content="width=device-width, initial-scale=1"];
        meta[name="description", content=${text(description)}];
        meta[name="theme-color", content="#101814"];
        title { ${text(title)} }
        link[rel="preconnect", href="https://fonts.googleapis.com"];
        link[rel="preconnect", href="https://fonts.gstatic.com", crossorigin="anonymous"];
        link[href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap", rel="stylesheet"];
        link[rel="stylesheet", href="/app.css"];
        ${googleTagManagerHead}
      }
      body {
        ${googleTagManagerBody}
        ${nav}
        main { ${content} }
        ${footer}
      }
    }
  `
}
