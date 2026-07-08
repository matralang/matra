# Matra Graphics

[English](./README.md) | [日本語](./README.ja.md)

Matra言語向けのSVG rendererとvector graphics libraryです。Matraのdomain-neutralなASTを使いながら、SVG固有のserialize規則をこのパッケージに閉じ込めます。

## Matra source

```matra
svg(
  rect(x=0, y=0, width=256, height=256, fill="#fffaf0"),
  circle(cx=128, cy=128, r=72, fill="#ff4d6d"),
  width=256,
  height=256
)
```

Matra sourceは直接SVGへcompileできます。

```ts
import { compile } from "@matra/graphics"

const output = compile(source, { pretty: true })
```

## ASTとrenderer API

純粋なJavaScript APIでも、Matraと同じdomain-neutral ASTを組み立てられます。

```ts
import { svgNode, toSVG } from "@matra/graphics"

const artwork = svgNode("svg", { width: 256, height: 256 }, [
  svgNode("circle", { cx: 128, cy: 128, r: 72, fill: "#ff4d6d" }),
])

const output = toSVG(artwork)
```

`svgRenderer`は`@matra/core`の`MatraRenderer` contractを実装しているため、`renderWith()`からも利用できます。

Rendererはshape、textと`tspan`、image、再利用可能な`defs`、gradient、pattern、mask、marker、標準SVG filter primitiveを扱います。JavaScriptからはcamel-caseのpresentation attributeや`style` objectを使え、serialize時にSVG attribute名へ変換されます。人が読むSVG sourceを生成する場合は、`pretty: true`またはindent幅を指定します。

## Legacy JavaScript API

既存の作例向けに、初期のstate-based drawing APIも引き続き利用できます。

```ts
import { circle, fill, svgLayout } from "@matra/graphics/legacy"

fill("#ff4d6d")
const output = svgLayout([circle(128, 128, 72)])
```

新しい統合では`compile`、`svgNode`、`toSVG`を優先してください。legacy APIは互換レイヤーであり、既存JavaScript examplesの移行経路として残しています。

## Development

```sh
npm test
npm run build
```

build commandは`example/page/`配下の`.matra`とJavaScript fileを`example/dist/`へcompileします。
