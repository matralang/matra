# Matra Core

[English](./README.md) | [日本語](./README.ja.md)

Matra Core provides source parsing and evaluation, and the domain-neutral document
tree shared by HTML, Math, and Graphics. Output rules belong to domain packages.

## v0.3 source and document trees

Public `parse(source)` returns a `MatraModule` containing statements and expressions.
It does not directly return a renderer-ready `MatraAST` or MatraJSON.
[Grammar v0.3](../../spec/grammar.md) defines source syntax and evaluation.

```ts
import { evaluateStatic, parse, staticValueToAST } from "@matra/core"

const module = parse(`
let title = "Matra"
article {
  h1 { title }
  <p.lead>Hello <strong>Matra</strong>!</p>
}
`)
const ast = staticValueToAST(evaluateStatic(module))
```

`evaluateStatic()` retrieves static values, references, and nodes. Calls, operators,
and control flow that require execution throw `EvaluationRequiredError`.
Use `evaluate(module)` for explicit execution.
For JavaScript values and functions, use the separate
[literate host](../../spec/literate-modules.md).

```ts
import { evaluate, parse, staticValueToAST } from "@matra/core"

const ast = staticValueToAST(evaluate(parse(`
fn double(n) { return n * 2 }
ul {
  ...for (n in [1, 2, 3]) { li { double(n) } }
}
`)))
```

Node construction includes a body: `circle(cx=10, cy=20, r=5) {}`.
`Sin(x)` is a function call, distinct from document node construction.
Syntax errors use `ProgramSyntaxError` with a source offset in the message.
Current `parse()` has no `locations` or `sourceId` options; `parseWith()` is not exported.

## Morphion document model

Represent each document node as finite terms with an exponent and coefficient
`val`. Exponent 0 denotes the tag, positive integer n denotes children[n - 1],
and string key denotes props[key].

```ts
import { astToMorphion, morphionToAST } from "@matra/core"

const terms = astToMorphion({ tag: "p", props: { class: "lead" }, children: ["Hello"] })
// [{ exponent: 0, val: "p" }, { exponent: 1, val: "Hello" },
//  { exponent: "class", val: "lead" }]
const ast = morphionToAST(terms)
```

Both conversions copy values and omit node positions. Zero coefficients remain
part of the document. This is a node-local correspondence with nested nodes
retained as document ASTs. See the
[Data Model](../../spec/data-model.md#morphion-correspondence) for the contract.
It is distinct from the expression-expansion `MorphionForm` in
`@matra/math-compute-engine`.

## Two document tree representations

`staticValueToAST()` converts a document value into the object-shaped AST used by
visitors, transformers, and renderers.

```ts
const ast = {
  tag: "article",
  props: { lang: "ja" },
  children: ["text", { tag: "p", props: {}, children: ["Hello"] }],
}
```

MatraJSON is the three-element interchange representation:

```ts
["article", { lang: "ja" }, ["text", ["p", {}, ["Hello"]]]]
```

Use `astToMatraJSON(ast)` and `matraJSONToAST(tuple)` to convert between them.
`visit()` and `transform()` also operate on document ASTs, not `MatraModule`.
See the [Data Model](../../spec/data-model.md) for document values.

## HTML and SVG

```ts
import { evaluateStatic, parse, renderWith, staticValueToAST } from "@matra/core"
import { toHTML } from "@matra/html"

const ast = staticValueToAST(evaluateStatic(parse('<p.lead>Hello</p>')))
toHTML(ast)
// <p class="lead">Hello</p>
```

Domain packages implement `MatraRenderer`, also callable through
`renderWith(renderer, ast, options)`. Evaluate source expressions before rendering.
`evaluatePropExpressions(ast, evaluator)` is a separate helper for property
expressions in document ASTs constructed by the host.

## JSONMatra file family

```text
.matra.json  = strict JSON-compatible Matra exchange format
.matra.js    = JavaScript-compatible Matra generation module
.jsonm       = experimental source placeholders
```

`loadMatra(path)` reads `.matra.json` with `JSON.parse`, and loads the default
export of a trusted JavaScript module for `.matra.js`. The latter executes
arbitrary JavaScript. Currently `.jsonm` only preserves tagged `matra.doc` and
`matra.expr` sources as placeholders; it is not a general JSON superset parser
or evaluator.

```js
import { matra, normalizeMatra } from "@matra/core"

export default matra.ast({
  tag: "article",
  props: {},
  children: ["Hello"],
})
```

`normalizeMatra()` and `matra.ast()` normalize host values. Their acceptance
boundary is not document data model validation. Use JSON-compatible values for
interchange and output, and satisfy each renderer's input contract.
`matra.doc` and `matra.expr` preserve source without executing it.

## Markdown documents

`extractMatraMarkdown(markdown, { entry: "page.matra" })` extracts a named fence.
It does not resolve or execute JavaScript dependencies. Pass its `.source` to
`parse()`. `extractMarkdownFences()` lists named fences.

See [literate programming](../../spec/literate-modules.md) for execution with
published values and functions. The [Web page validation example](../html/examples/web-page.md)
generates HTML from Markdown through JavaScript integration and Wasm execution.

## TypeScript templates

The `matra` template returns source text. Ordinary string interpolation is quoted
and escaped. `matra.raw()` inserts a trusted source fragment verbatim.

```ts
import { evaluateStatic, matra, parse, staticValueToAST } from "@matra/core"

const title = "Matra & Web"
const source = matra`article { h1 { ${title} } }`
const ast = staticValueToAST(evaluateStatic(parse(source)))
```

## Standard collection functions

`Range` creates an inclusive sequence; `Map` applies a JavaScript function.

```ts
import { Map, Range, evaluateStandard } from "@matra/core"

Map(value => Number(value) ** 2, Range(1, 4))
// [1, 4, 9, 16]
evaluateStandard({ tag: "Range", props: {}, children: [1, 4] })
// [1, 2, 3, 4]
```

`evaluateStandard()` handles document ASTs containing `Range`, `Map`, `Lambda`,
`Var`, and registered functions. It is not the evaluator for the `MatraModule`
returned by v0.3 `parse()`.

## Package structure

```text
src/
├── ast/        # document types, conversion, traversal, transformation
├── program.ts  # current source parser, static retrieval, explicit evaluation
├── parser/     # public parse export, historical Peggy grammar assets
├── jsonmatra.ts # file input and host value helpers
├── markdown.ts # source fence extraction
├── render.ts   # renderer boundary
└── standard.ts # standard functions on document ASTs
```

Current `parse()` uses `program.ts`. The Peggy parser regenerated during builds
is not the current public parser. Do not edit generated files directly.

## Documentation languages

English documents use `name.md`; Japanese counterparts use `name.ja.md`.
Keep heading structure and code examples aligned.
