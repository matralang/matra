# Matra Graphics

[English](./README.md) | [日本語](./README.ja.md)

Matra言語向けのSVG rendererとvector graphics libraryです。Matraのdomain-neutralなASTを使いながら、SVG固有のserialize規則をこのパッケージに閉じ込めます。

## Matra source

```matra
svg(width=256 height=256) {
  rect(x=0 y=0 width=256 height=256 fill="#fffaf0") {}
  circle(cx=128 cy=128 r=72 fill="#ff4d6d") {}
}
```

Matra sourceは直接SVGへcompileできます。

```ts
import { compile } from "@matra/graphics"

const output = compile(source, { pretty: true })
```

## データグラフ

`lineChart()`と`scatterPlot()`は、単一系列のグラフをSVG AST nodeとして生成します。

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

どちらも線形軸と5個の目盛りを使い、dataから各domainを推定して5%の余白を加えます。
`xDomain`と`yDomain`に`[minimum, maximum]` tupleを指定すると範囲を固定できます。
その場合、すべての点は指定範囲内に置きます。`lineChart()`は入力順に点を結びます。
canvasの既定サイズは480×320で、`width`、`height`、`color`をoptionsで変更できます。
`title`は表示され、SVGのaccessibility nameにも使われます。

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

SVG ASTは`@matra/html`へ渡すことで、HTML内へinline埋め込みできます。

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
pnpm test
pnpm run build
```

build commandは`example/page/`配下の`.matra`とJavaScript fileを`example/dist/`へcompileします。
