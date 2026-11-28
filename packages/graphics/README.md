# Matra Graphics

[English](./README.md) | [日本語](./README.ja.md)

SVG renderer and vector graphics library for the Matra language.

## Matra source

```matra
svg(width=256 height=256) {
  rect(x=0 y=0 width=256 height=256 fill="#fffaf0") {}
  circle(cx=128 cy=128 r=72 fill="#ff4d6d") {}
}
```

Compile it directly to SVG:

```ts
import { compile } from "@matra/graphics"

const output = compile(source, { pretty: true })
```

## Data charts

`lineChart()` and `scatterPlot()` create single-series charts as SVG AST nodes:

```ts
import { lineChart, toSVG } from "@matra/graphics"

const points = [
  { x: 0, y: 1 },
  { x: 1, y: 3 },
  { x: 2, y: 2 },
]

const chart = lineChart(points, {
  title: "Example",
  xLabel: "time",
  yLabel: "value",
})
const output = toSVG(chart)
```

Both APIs use linear axes with five tick marks and infer each domain from the
data with 5% padding. Provide `xDomain` and `yDomain` as `[minimum, maximum]`
tuples to set explicit ranges; all points must fall within those ranges.
`lineChart()` connects points in input order. The default canvas is 480×320;
`width`, `height`, and `color` can be set in the options. `title` is shown and
also exposed as the SVG's accessible name.

## AST and renderer API

The pure JavaScript API builds the same domain-neutral AST used by Matra:

```ts
import { svgNode, toSVG } from "@matra/graphics"

const artwork = svgNode("svg", { width: 256, height: 256 }, [
  svgNode("circle", { cx: 128, cy: 128, r: 72, fill: "#ff4d6d" }),
])

const output = toSVG(artwork)
```

`svgRenderer` implements the `MatraRenderer` contract from `@matra/core`, so
it can also be used with `renderWith()`.

The SVG AST can be embedded inline in HTML by passing it to `@matra/html`:

```ts
import { toHTML } from "@matra/html"
import { svgNode } from "@matra/graphics"

const icon = svgNode("svg", {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  width: 24,
  height: 24,
}, [svgNode("circle", { cx: 12, cy: 12, r: 10, fill: "tomato" })])

const page = toHTML([{ tag: "figure", props: {}, children: [icon] }])
```

The renderer supports shapes, text and `tspan`, images, reusable definitions,
gradients, patterns, masks, markers, and the standard SVG filter primitives.
JavaScript callers may use camel-case presentation attributes and a style
object; they are serialized to SVG attribute names automatically. Set
`pretty: true` (or an indentation width) when the SVG source is intended for
people to read.

## Legacy JavaScript API

The original state-based drawing API remains available for existing artwork:

```ts
import { circle, fill, svgLayout } from "@matra/graphics/legacy"

fill("#ff4d6d")
const output = svgLayout([circle(128, 128, 72)])
```

New integrations should prefer `compile`, `svgNode`, and `toSVG`. The legacy
API is kept as a compatibility layer and as a migration path for existing
JavaScript examples.

## Development

```sh
pnpm test
pnpm run build
```

The build command compiles both `.matra` and JavaScript files from
`example/page/` into `example/dist/`.
