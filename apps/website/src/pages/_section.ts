import { matra, text } from "../matra"
import defaultLayout from "../layouts/default-layout"

export function sectionPage(
  eyebrow: string,
  title: string,
  description: string,
  links: Array<{ href: string; label: string; detail: string }> = [],
): string {
  const cards = links.map(({ href, label, detail }, index) => matra`
    a.docs-card[href=${text(href)}] {
      span { ${text(String(index + 1).padStart(2, "0"))} }
      div { h2 { ${text(label)} } p { ${text(detail)} } }
    }
  `).join("")

  return defaultLayout(matra`
    section.hero {
      div.shell {
        div.hero-copy {
          p.eyebrow { ${text(eyebrow)} }
          h1 { ${text(title)} }
          p.lede { ${text(description)} }
          div.docs-card-list { ${cards} }
        }
      }
    }
  `, { title: `${title} — Matra`, description })
}
