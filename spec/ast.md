# Matra AST v0.2

[English](./ast.md) | [日本語](./ast.ja.md) | [Index](./README.md)

## Purpose

The AST is the object-shaped in-memory representation used by visitors,
transformers, and renderers. It represents the same information as
[MatraJSON](./data-model.md#matrajson); it is not a second data model.

## Shape

```ts
type MatraScalar = string | number | boolean | null
type MatraValue =
  | MatraScalar
  | MatraValue[]
  | { [key: string]: MatraValue }

interface MatraAST {
  tag: string
  props: Record<string, MatraValue>
  children: Array<MatraAST | MatraValue>
}
```

An AST node MUST have exactly the semantic fields `tag`, `props`, and
`children`. Implementations MAY attach metadata, but metadata MUST NOT change
the Matra data-model value.

## Example

```ts
{
  tag: "group",
  props: { role: "list" },
  children: [
    { tag: "item", props: {}, children: ["one"] },
    { tag: "item", props: {}, children: ["two"] },
  ],
}
```

## Conversion

Conversion between AST and MatraJSON MUST be recursive and lossless for the
Matra data model:

```text
AST node                         MatraJSON node
{ tag, props, children }   <->   [tag, props, children]
```

Conversion MUST preserve tag text, property values, scalar types, nested
nodes, and child order. Implementations SHOULD copy mutable lists and maps so
that conversion does not unexpectedly alias the input.

## Validation

An AST validator MUST reject a node when:

- `tag` is not a string;
- `props` is not a string-keyed map of Matra values;
- `children` is not a list; or
- a child is neither an AST node nor a Matra value.
