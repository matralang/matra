import { matra } from "@matra/core"

export type CardLink = { href: string, label: string, detail: string }

export function docsCards(links: CardLink[]) {
  return matra.raw(links.map((link, index) => matra`
    a.docs-card(href=${link.href}) {
      span { ${String(index + 1).padStart(2, "0")} }
      div { h2 { ${link.label} }; p { ${link.detail} } }
    }
  `).join("\n"))
}
