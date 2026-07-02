# Matra Specification v0.1

[English](./README.md) | [日本語](./README.ja.md)

## Status

This document defines Matra language version 0.1. The key words **MUST**,
**MUST NOT**, **SHOULD**, and **MAY** are to be interpreted as normative
requirements. Package versions are independent of the language version.

Matra is a domain-neutral notation for describing a rooted tree. HTML, Math,
Graphics, and other domains assign meaning to tags and properties; those
meanings are outside this specification.

## Data model

A Matra document represents one node with these fields:

- `tag`: a string identifying the node.
- `props`: a string-keyed map of JSON-compatible values.
- `children`: an ordered list of nodes or JSON-compatible values.

The interchange form, MatraJSON, is a three-element array:

```text
[tag, props, children]
```

For example:

```matra
group(item("one"), item("two"), role="list")
```

represents:

```json
["group", { "role": "list" }, [
  ["item", {}, ["one"]],
  ["item", {}, ["two"]]
]]
```

The object-shaped AST used by an implementation is not part of the source
language, but it MUST preserve the same tag, properties, and child order.

## Source text

Source text is Unicode. Spaces, tabs, carriage returns, and line feeds are
whitespace. Whitespace between tokens is insignificant except inside quoted,
backtick, and tilde text.

A document MUST contain exactly one root expression. `$root { ... }` MAY be
used when several nodes need a synthetic common root.

## Function syntax

Function syntax is the canonical v0.1 notation:

```matra
tag(child1, child2, property="value")
```

The name before `(` becomes the tag. Positional arguments become children in
source order. An argument of the form `name=value` becomes a property and does
not become a child.

```matra
circle(x=10, y=20, r=5)
note("hello", priority=2, visible=true, owner=null)
```

Supported literal values are strings, numbers, booleans, and `null`.

- Strings use double quotes. v0.1 does not define escape sequences.
- Numbers may be signed and may use a decimal fraction or exponent.
- The reserved words `true`, `false`, and `null` cannot be identifiers.
- Bare identifiers used as values are strings.
- A property name MUST NOT occur more than once in the same node.

Nested function calls are node children:

```matra
section(heading("Title"), paragraph("Body"), id="intro")
```

For compatibility, an object in the first or any positional argument MAY
supply properties:

```matra
circle({x: 10, y: 20}, "label")
```

Keyword properties are canonical. New documents SHOULD NOT use the
object-style compatibility form.

## Document syntax

Document syntax is a compact alternative:

```matra
article.card#main[lang="en"] {
  h1 { "Title" }
  p`Body`
}
```

A tag may be followed by any number of `.class` selectors and at most one
effective `#id` selector. Classes are joined with a single space into the
`class` property. An ID selector becomes the `id` property. Brackets contain
zero or more `name="value"` properties.

A brace body contains child nodes or one double-quoted string. Backtick text
and tilde text are shorthand for one string child:

```matra
p`hello`
p~hello~
```

Both forms represent `p("hello")`. Their delimiters are literal and cannot be
escaped in v0.1.

An HTML-style comment is represented as a `#comment` node:

```matra
<!-- explanation -->
```

## Syntax modes

Parsers MAY expose a syntax-mode option with these values:

| Mode | Accepted notation |
| --- | --- |
| `mixed` | Function and document syntax |
| `document` | Document syntax only |
| `application` | Function syntax only |

If a mode is supported, `mixed` MUST be the default. Using a disallowed
notation MUST produce a parse error.

## Domain semantics

Tags and property names have no built-in domain meaning. In particular, v0.1
does not define HTML rendering, interpolation, directives such as `m-if`, or
evaluation. A domain package MAY define those behaviors after parsing.

## Errors and conformance

A conforming parser MUST:

- reject malformed or trailing source text;
- preserve child order and literal value types;
- reject duplicate properties in function syntax; and
- produce a tree equivalent to the data model above.

A conforming serializer or renderer MUST document any domain-specific
interpretation it applies. It MUST NOT describe that interpretation as part of
the Matra v0.1 language unless this specification is revised.

## Historical documents

Pre-specification Core guides are retained in
[`archive/core-v0.8`](./archive/core-v0.8/README.md). They describe an earlier,
HTML-oriented implementation and are non-normative.
