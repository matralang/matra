---
matra:
  entry: main.matra
  values:
    - content.js.part
---

# Hello, Matra

Edit this document, then run `matra build`.
Open `dist/index.html` in a browser. No network connection is needed to view it.

## Page structure

```main.matra
html(lang="en") {
  head {
    meta(charset="utf-8") {}
    meta(name="viewport" content="width=device-width, initial-scale=1") {}
    title { content.title }
    link(rel="stylesheet" href="./matra.css") {}
  }
  body {
    header {
      h1 { content.title }
    }
    main {
      p { content.message }
      h2 { "Get started" }
      ol {
        ...for (step in content.steps) {
          li { step }
        }
      }
    }
    footer {
      p { "Built with Matra." }
    }
  }
}
```

## Page content

The selected JavaScript expression below supplies the page data.
Only build documents you trust: their JavaScript is executed during the build.

```content.js.part
({
  title: "Hello, Matra!",
  message: "Your first Matra page is ready.",
  steps: [
    "Edit index.md to change the structure and content.",
    "Edit matra.css to customize the appearance.",
    "Run matra build and open dist/index.html."
  ]
})
```
