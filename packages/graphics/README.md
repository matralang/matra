# Matra Graphics

SVG renderer and vector graphics library for the Matra language.

## Matra source

```matra
svg(
  rect(x=0, y=0, width=256, height=256, fill="#fffaf0"),
  circle(cx=128, cy=128, r=72, fill="#ff4d6d"),
  width=256,
  height=256
)
```

Compile it directly to SVG:

```ts
import { compile } from "@matra/graphics"

const output = compile(source)
```

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
npm test
npm run build
```

The build command compiles both `.matra` and JavaScript files from
`example/page/` into `example/dist/`.
