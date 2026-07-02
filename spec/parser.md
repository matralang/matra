# Matra Parser v0.1

[English](./parser.md) | [日本語](./parser.ja.md) | [Index](./README.md)

## Contract

A parser accepts Matra source text and returns a tree equivalent to the
[data model](./data-model.md). Its minimal interface is:

```ts
interface MatraParser<Output = MatraAST | MatraJSON> {
  parse(source: string, options?: ParseOptions): Output
}
```

A parser MAY return MatraJSON or the object-shaped AST. A consumer MAY
normalize either representation to AST.

## Parse operation

For each call, a conforming parser MUST:

1. consume exactly one root expression and all surrounding whitespace;
2. reject malformed or trailing non-whitespace source;
3. preserve tag and property text;
4. preserve child order and literal types; and
5. return a tree conforming to the Data Model and AST specifications.

Duplicate property names in function syntax MUST produce a parse error,
including duplicates introduced by combining keyword and compatibility-object
properties.

## Syntax modes

A parser MAY support `syntaxMode`:

| Mode | Accepted syntax |
| --- | --- |
| `mixed` | Function and document syntax |
| `document` | Document syntax only |
| `application` | Function syntax only |

When modes are implemented, `mixed` MUST be the default. A function node in
`document` mode or a document node in `application` mode MUST produce a parse
error. Mode restrictions do not change the resulting data model.

## Errors

Parse failure MUST be distinguishable from successful output. An error SHOULD
include the source location and a useful message. The concrete error class and
message wording are implementation-defined.

A parser MUST NOT return a partial tree as a successful result after a syntax,
duplicate-property, or mode error.

## Replaceability

Parser implementations are replaceable when they accept the same v0.1 source
subset and produce data-model-equivalent output. Consumers MUST NOT depend on
parser-internal node identities or grammar-engine details.

## Conformance examples

```matra
sum(value("a"), 2, axis="x")
```

MUST produce a tree equivalent to:

```json
["sum", { "axis": "x" }, [["value", {}, ["a"]], 2]]
```

The following MUST fail because `axis` is duplicated:

```matra
sum(axis="x", axis="y")
```
