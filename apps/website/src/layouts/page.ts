import { matra } from "@matra/core"

export function pageLayout(options: {
  title: string
  description: string
  content: string
}): string {
  return matra`
    html(lang="ja") {
      head {
        meta(charset="UTF-8") {}
        meta(name="viewport", content="width=device-width, initial-scale=1") {}
        meta(name="description", content=${options.description}) {}
        meta(property="og:type", content="website") {}
        meta(property="og:title", content=${options.title}) {}
        meta(property="og:description", content=${options.description}) {}
        meta(name="twitter:card", content="summary_large_image") {}
        meta(name="twitter:title", content=${options.title}) {}
        meta(name="twitter:description", content=${options.description}) {}
        meta(name="theme-color", content="#101814") {}
        title { ${options.title} }
        link(rel="stylesheet", href="/app.css") {}
      }
      body { main { ${matra.raw(options.content)} } }
    }
  `
}
