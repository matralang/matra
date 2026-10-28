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

## Morphion correspondence

Document Morphion, defined here, is a concept introduced in v0.3 to treat
Matra AST as a coherent mathematical model. Rather than merely converting to
another format, it locates each node component uniquely by an exponent and
represents the node as a finite mapping from exponents to coefficients. A term
list is a notation for this finite mapping. This describes the structure and
values of a document node through a mathematical correspondence; it does not
mean that the node is computed as an ordinary polynomial.

A document node is represented by finitely many terms with an exponent and a
coefficient named `val`. Exponents are non-negative safe integers or strings.
Numeric `0` and string `"0"` are distinct exponents.

| Exponent | Meaning of coefficient `val` |
| --- | --- |
| Numeric `0` | The `tag` string |
| Positive integer `n` | `children[n - 1]` |
| String `key` | `props[key]` |

```json
[
  { "exponent": 0, "val": "p" },
  { "exponent": 1, "val": "Hello" },
  { "exponent": 2, "val": 0 },
  { "exponent": "class", "val": "lead" }
]
```

These terms represent a `p` node with `class="lead"` and children `["Hello", 0]`.
Within a node, exponents identify the tag, child positions, or property keys,
and `val` retains the value at that location. Reconstructing the AST from the
corresponding Morphion retains child order, property keys, and values.
Separating numeric and string exponents also prevents a child position from
colliding with a property key having the same textual form.
`@matra/core` provides the `MatraMorphion` type, `astToMorphion(ast)` and
`morphionToAST(terms)`. The representation is local to one node: coefficients
retain nested nodes as existing document ASTs. The same correspondence can be
applied to those nodes. Values inside arrays and maps are not reinterpreted as
nodes. Convert an evaluated document AST, not the parser's `MatraModule`.
Under the constraints in this specification, an AST and its Morphion uniquely
reconstruct one another, excluding source positions.

A form MUST have exactly one exponent `0` term with a string coefficient.
Child exponents MUST be contiguous from `1`; exponents MUST NOT be duplicated.
Gaps, duplicates, negative, fractional, non-finite and unsafe integer exponents
are rejected. Reverse conversion is independent of term input order.
`astToMorphion()` emits exponent `0`, ascending child integers, then property
keys in ascending UTF-16 code unit order.

Terms identify document positions and keys: coefficients `0`, `false`, `null`
and empty strings MUST NOT be removed. Adding like terms, removing zero terms
and multiplying terms are not defined. Exponents are structural addresses in
the document, not powers of mathematical bases. This document model is distinct from
the Compute Engine adapter's expression-expansion `MorphionForm`.
Coefficients follow the document data model; functions, non-finite numbers and
cycles are rejected. Conversions copy values and omit node source positions.
Existing grammar, MatraJSON, evaluation rules and compiler ABI are unchanged.

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

Directly within `children`, a three-element array matching this shape is
interpreted as a node. The contents of an array value MUST NOT be recursively
interpreted as nodes. Therefore, a value array that has node shape can be
preserved by wrapping it in at least one array or map.

```json
["div", {"attr": [["chart", {}, []]]}, []]
```

The `attr` value above is an array; its inner three-element array is not a
node. Producers SHOULD avoid placing a value array indistinguishable from a
MatraJSON node directly without such a wrapper.

Within `props`, an expression node uses the same three-element MatraJSON
encoding. Object-shaped ASTs preserve it as an object-shaped node.

## Equality

XML-style markup in the standard grammar constructs the same nodes. `<hr />`, `<hr></hr>`,
and `hr {}` are equivalent. Markup attributes are strings; content becomes strings and child nodes,
with character references decoded. Quote style and self-closing spelling are not retained.
Namespace names are retained as strings without URI resolution.
In `<a.button>Link</a>`, `.button` is class shorthand, not part of the tag name;
it is equivalent to `a.button { "Link" }`.
See the [grammar specification](./grammar.md).

Two Matra documents are data-model-equivalent when their tags, property keys
and values, child values, and child order are recursively equal. Property
serialization order is not significant.

## Source positions

An object-shaped AST node MAY have a `position` member containing `start` and
`end` source points. Each point contains a zero-based `offset` and one-based
`line` and `column`. A position MAY also contain a source identifier.

Source positions are parser metadata, not part of data-model equality. The
canonical three-element MatraJSON representation intentionally omits them.

## Domain semantics

The data model does not define rendering, interpolation, directives, or tag
behavior. A domain MAY interpret a tree after it has been constructed.
