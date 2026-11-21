# @matra/site-generation

`@matra/site-generation` generates static websites from Markdown content and
Matra pages and layouts. It provides a file-based API for projects configured
with `matra.site.yaml`, `matra.site.json`, or `matra.site.matra`, as well as a
JavaScript API for registering pages directly.

## Requirements

Node.js 22 or later is recommended. Install the package in a project:

```sh
npm install @matra/site-generation
```

## File-based generation

Create a site configuration in the project root:

```yaml
version: 1
site:
  pages: pages
  layouts: layouts
  defaultLayout: default
  output: dist
```

Add Markdown pages under `pages/`. Ordinary `.md` files are published as
content. Executable Matra pages and layouts use the `.matra.md` extension and
declare their entry point with `matra.entry` front matter. Then build the site:

```js
import { buildSite } from "@matra/site-generation"

const outputs = await buildSite(process.cwd())
console.log(`Generated ${outputs.length} files`)
```

`buildSite()` reads the site configuration, collects pages, layouts, and
documents, renders the site, and returns the generated file paths. The
`matra.site.yaml`, `matra.site.json`, and `matra.site.matra` formats use the
same versioned schema.

## Direct JavaScript API

Use `generateSite()` when page data is already available in JavaScript and
should be passed directly to Matra without writing intermediate files:

```js
import { generateSite } from "@matra/site-generation"

const products = [
  { slug: "first", title: "First product", description: "Product details" },
  { slug: "second", title: "Second product", description: "More details" },
]

const outputs = await generateSite({
  root: process.cwd(),
  defaultLayout: "default",
  layouts: {
    default: { source: "html { head {}; body { ...page.content } }" },
  },
  pages: products.map(product => ({
    kind: "matra",
    route: `/products/${product.slug}/`,
    source: "main { h1 { page.data.title }; p { page.data.description } }",
    data: product,
  })),
})
console.log(`Generated ${outputs.length} files`)
```

Each page specifies `kind` (`"matra"` or `"markdown"`), a `route`, and a
`source` string. Optional `data`, `layout`, and `document` fields provide page
data, select a layout (or disable it with `layout: false`), and set the
logical document path used for diagnostics and relative links. `layouts` and
`components` map names to `{ source, document? }` objects.

Both APIs support layouts, assets, a base path, and reusable Matra components.
Matra components are defined as `fn Name(props, children) { ... }` and return
one document node. See the [site-generation contract](../../spec/site-generation.md)
for the complete configuration schema, input rules, component behavior, and
output guarantees.

## Output safety

The generator validates inputs and renders pages before publishing. Generated
files are staged and published together; generation or validation failures
preserve the previous output. A manifest tracks generated files so obsolete
generated files can be removed on a later successful build without deleting
untracked files. Input symlinks and paths outside the project root are
rejected.

## License

MIT
