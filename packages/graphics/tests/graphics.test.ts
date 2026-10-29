import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"
import { renderWith } from "@matra/core"
import { toHTML } from "@matra/html"
import { compile, svgNode, svgRenderer, toSVG } from "../src/index.ts"

test("renders a Matra graphics AST as SVG", () => {
  const ast = svgNode("svg", { width: 100, height: 80 }, [
    svgNode("circle", { cx: 50, cy: 40, r: 20, fill: "tomato" }),
  ])
  assert.equal(
    toSVG(ast),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" width="100" height="80"><circle cx="50" cy="40" r="20" fill="tomato"></circle></svg>',
  )
})

test("embeds the SVG AST as an inline figure in HTML", () => {
  const artwork = svgNode(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 100 80",
      width: 100,
      height: 80,
    },
    [svgNode("circle", { cx: 50, cy: 40, r: 20, fill: "tomato" })],
  )

  assert.equal(
    toHTML([{ tag: "figure", props: {}, children: [artwork] }]),
    `<figure>${toSVG(artwork)}</figure>`,
  )
})

test("compiles Matra source to SVG", () => {
  const result = compile('svg(width=64 height=64) { circle(cx=32 cy=32 r=20 fill="red") {} }')
  assert.match(result, /^<svg[^>]+viewBox="0 0 64 64"/)
  assert.match(result, /<circle cx="32" cy="32" r="20" fill="red"><\/circle>/)
})

test("compiles the whitespace-separated basic artwork example", async () => {
  const source = await readFile(new URL("../example/page/basic.matra", import.meta.url), "utf8")
  assert.equal(
    compile(source),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><rect x="0" y="0" width="256" height="256" fill="#fffaf0"></rect><circle cx="128" cy="128" r="72" fill="#ff4d6d" stroke="#171717" stroke-width="4"></circle><text x="128" y="132" fill="white" text-anchor="middle" dominant-baseline="middle">Matra</text></svg>',
  )
})

test("builds every existing artwork example as a complete SVG document", async () => {
  const outputDirectory = new URL("../example/dist/", import.meta.url)
  const outputs = (await readdir(outputDirectory)).filter(file => file.endsWith(".svg")).sort()

  assert.deepEqual(outputs, [
    "bagua.svg",
    "basic.svg",
    "flkm-circle.svg",
    "flkm-torus.svg",
    "kami.svg",
    "kamomi.svg",
    "raiun-rasen.svg",
    "raiun-torus.svg",
  ])
  for (const file of outputs) {
    const svg = await readFile(new URL(file, outputDirectory), "utf8")
    assert.match(svg, /^<svg\b/)
    assert.match(svg, /<\/svg>\n$/)
  }
})

test("implements the core renderer contract", () => {
  const ast = svgNode("rect", { x: 1, y: 2, width: 3, height: 4 })
  const result = renderWith(svgRenderer, ast, { width: 10, height: 10 })
  assert.match(result, /<rect x="1" y="2" width="3" height="4"><\/rect>/)
})

test("rejects non-SVG Matra elements", () => {
  assert.throws(() => compile('script { "alert(1)" }'), /Unsupported SVG element/)
})

test("wraps a Matra document fragment in an SVG root", () => {
  const result = toSVG(
    {
      tag: "$root",
      props: {},
      children: [
        svgNode("circle", { cx: 10, cy: 10, r: 5 }),
        svgNode("rect", { x: 20, y: 20, width: 10, height: 10 }),
      ],
    },
    {
      width: 40,
      height: 40,
    },
  )
  assert.match(result, /<circle/)
  assert.match(result, /<rect/)
})

test("supports richer SVG elements, camel-case attributes, and style objects", () => {
  const result = compile(`svg(width=120, height=40) {
    defs { linearGradient(id="shine") { stop(offset="0%", stopColor="#fff") {} } }
    text(x=10, y=20) { tspan(fontWeight=700) { "Matra" } }
    filter(id="blur") { feGaussianBlur(stdDeviation=3) {} }
  }`)
  assert.match(result, /stop-color="#fff"/)
  assert.match(result, /font-weight="700"/)
  assert.match(result, /<feGaussianBlur stdDeviation="3">/)

  const styled = toSVG(svgNode("svg", { style: { backgroundColor: "#fff", opacity: 0.8 } }))
  assert.match(styled, /style="background-color:#fff;opacity:0.8"/)
})

test("can format SVG for source views", () => {
  const result = compile("svg(width=10, height=10) { circle(cx=5, cy=5, r=4) {} }", {
    pretty: true,
  })
  assert.match(result, /<svg[^>]*>\n {2}<circle/)
  assert.match(result, /\n<\/svg>$/)
})
