# Matra Data Model v0.2

[English](./data-model.md) | [日本語](./data-model.ja.md) | [Index](./README.md)

## Node

A Matra document represents exactly one root node. A node is an ordered tuple
of:

1. `tag`: a string identifying the node;
2. `props`: a map from string keys to values; and
3. `children`: an ordered list of nodes or values.

Tags and property keys MUST be strings. Their domain-specific meaning is not
defined by this specification.

## Values

A value is one of:

- string;
- finite number;
- boolean;
- null;
- an ordered list of values; or
- a map from string keys to values.

Values MUST be JSON-compatible. `undefined`, functions, symbols, big integers,
non-finite numbers, and cyclic structures are not Matra values.

A property value MAY be a node. Such a node represents an unevaluated
expression. Domains evaluate property expressions before rendering; a renderer
MAY reject an expression that reaches it unevaluated.

```matra
circle(cx=Cos(theta))
```

```json
{
  "tag": "circle",
  "props": {
    "cx": { "tag": "Cos", "props": {}, "children": ["theta"] }
  },
  "children": []
}
```

## MatraJSON

MatraJSON is the canonical interchange representation of the data model. A
node is encoded as a three-element JSON array:

```text
[tag, props, children]
```

Example:

```json
["group", { "role": "list" }, [
  ["item", {}, ["one"]],
  ["item", {}, ["two"]]
]]
```

The first item MUST be a string, the second MUST be a map, and the third MUST
be a list. Child order and scalar types MUST be preserved.

Within `children`, a three-element array matching this shape is interpreted as
a node. Producers SHOULD avoid value arrays that are indistinguishable from a
MatraJSON node.

Within `props`, an expression node uses the same three-element MatraJSON
encoding. Object-shaped ASTs preserve it as an object-shaped node.

## Equality

Two Matra documents are data-model-equivalent when their tags, property keys
and values, child values, and child order are recursively equal. Property
serialization order is not significant.

## Domain semantics

The data model does not define rendering, interpolation, directives, or tag
behavior. A domain MAY interpret a tree after it has been constructed.
