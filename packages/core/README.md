# Matra Core

[English](./README.md) | [日本語](./README.ja.md)

Matra Core is the small, domain-neutral foundation shared by HTML, Math,
Docs, and Graphics packages. It defines tree representations, conversion,
traversal, transformation, and replaceable parser and renderer boundaries.
Domain-specific evaluation and output rules live outside Core.

Domain packages implement the small `MatraRenderer` contract and can be
invoked consistently with `renderWith(renderer, ast, options)`. Core owns the
boundary, while SVG, HTML, and other output rules remain in their packages.

## Two tree representations

MatraJSON is the compact three-element representation emitted by parsers and
used for interchange:

```ts
["tag", { role: "example" }, ["text", ["child", {}, []]]]
```

The AST used by Core visitors, transformers, and renderers is object-shaped:

```ts
{
  tag: "tag",
  props: { role: "example" },
  children: ["text", { tag: "child", props: {}, children: [] }]
}
```

Convert explicitly at the boundary:

```ts
import { astToMatraJSON, matraJSONToAST } from "@matra/core"
```

## Replaceable parsers

A parser only needs a `parse(source, options?)` method and may return either
AST or MatraJSON. `parseWith()` normalizes both forms to AST.

```ts
import { parseWith } from "@matra/core"

const ast = parseWith(peggyParser, source)
```

The bundled Peggy implementation emits MatraJSON. Core's public `parse()`
adapts that output to AST, keeping the parser replaceable.

Request optional source positions when diagnostics or editor integration need
them. Syntax errors always include a location and code frame.

```ts
const ast = parse(source, {
  locations: true,
  sourceId: "drawing.matra",
})

ast.position
// { start: { offset: 0, line: 1, column: 1 }, ... }
```

Positions are omitted when converting to MatraJSON.

## HTML

HTML rendering is provided by the separate workspace package:

```ts
import { parse } from "@matra/core"
import { toHTML } from "@matra/html"

toHTML(parse('p("Hello", class="lead")'))
```

Function-style syntax uses Python-like keyword arguments for props:

```matra
circle(x=10, y=20, r=5)
```

Ordinary positional arguments become children. The earlier
`circle({x: 10, y: 20, r: 5})` form remains available for compatibility but
is not the canonical notation.

Function calls are also accepted as unevaluated prop expressions:

```matra
circle(cx=Cos(theta), r=Divide(3, 8))
```

They are represented as AST nodes inside `props`. Use
`evaluatePropExpressions(ast, evaluator)` to replace them immutably before
rendering.

## Standard collection functions

`Range` creates an inclusive sequence, and `Map` applies a registered function
to each value. `evaluateStandard()` evaluates their application-style Matra
syntax without storing JavaScript functions in the JSON-compatible AST.

```ts
import { evaluateStandard, parse } from "@matra/core"

evaluateStandard(parse("Range(1, 4)"))
// [1, 2, 3, 4]

evaluateStandard(parse("Map(square, Range(1, 4))"), {
  functions: { square: value => Number(value) ** 2 },
})
// [1, 4, 9, 16]
```

## Package structure

```text
src/
├── ast/       # types, conversion, traversal, transformation
├── parser/    # public parser boundary, grammar, generated parser
├── index.ts   # public exports
├── printer.ts # domain-neutral JSON serialization
├── render.ts  # replaceable renderer boundary
└── standard.ts # Range, Map, and standard evaluation
tests/
├── ast.test.mjs
├── parser.test.mjs
├── render.test.mjs
└── standard.test.mjs
```

The generated parser is rebuilt from `src/parser/grammar.pegjs`; edit the
grammar rather than `generated.mjs`. Language-level behavior is defined by the
[Matra Specification](../../spec/README.md).

## Documentation languages

English documents use `name.md`; their Japanese counterparts use
`name.ja.md`. Both versions should keep the same heading structure and code
examples so changes are easy to synchronize.
