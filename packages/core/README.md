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

## HTML

HTML rendering is provided by the separate workspace package:

```ts
import { parse } from "@matra/core"
import { toHTML } from "@matralang/matra-html"

toHTML(parse('p("Hello", class="lead")'))
```

Function-style syntax uses Python-like keyword arguments for props:

```matra
circle(x=10, y=20, r=5)
```

Ordinary positional arguments become children. The earlier
`circle({x: 10, y: 20, r: 5})` form remains available for compatibility but
is not the canonical notation.

## Documentation languages

English documents use `name.md`; their Japanese counterparts use
`name.ja.md`. Both versions should keep the same heading structure and code
examples so changes are easy to synchronize.
