# Matra CLI

[English](./README.md) | [日本語](./README.ja.md)

`@matra/cli` provides the `matra` command for initializing Matra projects,
building single-page documents and multi-page sites, installing declared
npm/Python dependencies, and serving a local development preview.

## Installation

Node.js 22 or 24 is required.

```sh
npm install --global @matra/cli
```

## Quick start

```sh
matra init hello
cd hello
matra build
matra dev
```

`matra init` creates `index.md` (FrontMatter, Matra structure, and JavaScript
data), an editable `matra.css` from `@matra/styles`, its license file, and a
`.gitignore`. The destination directory must not already exist.

`matra build` compiles and executes `index.md` in the current directory and
generates `dist/index.html`, `dist/matra.css`, and `dist/matra.css.LICENSE`.
Open the HTML directly in a browser; viewing needs no network.

`matra dev` serves the project on `127.0.0.1:3000` (configurable with
`--port`) and rebuilds on changes. Refresh the browser to view changes.

## SVG output

Include an `svg` node in Matra output and `matra build` emits it as inline SVG
in the generated HTML. Set SVG attributes explicitly, including `viewBox`.

```matra
html {
  head { title { "SVG example" } }
  body {
    svg(width=64 height=64 viewBox="0 0 64 64") {
      circle(cx=32 cy=32 r=20 fill="tomato") {}
    }
  }
}
```

## Charts with `@matra/graphics`

Declare `@matra/graphics` as a JavaScript package, then run `matra install` before
building. A named export from a `.js` module can be used as a Matra node, so the
chart is emitted inline in the generated HTML.

````markdown
---
matra:
  entry: main.matra
  values: [charts.js]
  javascript:
    packages: ["@matra/graphics"]
---

```main.matra
html {
  head { title { "Quarterly sales" } }
  body {
    main {
      h1 { "Quarterly sales" }
      charts.chart
    }
  }
}
```

```charts.js
import { lineChart } from "@matra/graphics"

export const chart = lineChart(
  [
    { x: 1, y: 24 },
    { x: 2, y: 32 },
    { x: 3, y: 28 },
  ],
  { title: "Quarterly sales", xLabel: "Quarter", yLabel: "Sales" },
)
```
````

```sh
matra install
matra build
```

## Commands

```text
matra init DIRECTORY
matra build
matra install [DOCUMENT] [--yes]
matra deps install [DOCUMENT] [--yes]
matra deps install (npm|python) DOCUMENT [--yes]
matra deps update (npm|python) DOCUMENT [--yes]
matra site install [--yes]
matra site build
matra dev [--port PORT]
matra --version
```

For external modules, list package names in `matra.javascript.packages` and
`matra.python.packages` in the document front matter, then run `matra install`
(alias: `matra deps install`) to prepare both ecosystems. The default document
is `index.md`. `matra deps install` prompts before network access; npm
lifecycle scripts are disabled.

## Multi-page sites

The CLI also supports a declarative site-generation workflow. Create
`matra.site.yaml`, `matra.site.json`, or `matra.site.matra`, put content under
`pages/`, then run `matra site install` and `matra site build` to generate
routes under `dist/`. See the
[site-generation contract](../../spec/site-generation.md) for the
configuration schema and limits.

## Security notes

Build only trusted documents: selected JavaScript and Python execute during
the build, without an OS sandbox or timeout.

## License

MIT
