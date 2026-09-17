# Unified Matra grammar v0.3 draft

[日本語](./unified-grammar.ja.md) | [Index](./README.md)

## Status and compatibility

This is the next authoritative grammar for general `.matra` files. As a v0.x
breaking change, it rejects Core v0.2 function nodes, `#id` selectors,
backtick/tilde text, `$root`, and `= expr`. `.matra.program` and the Rust seed
compiler are out of scope and retain their v0.1 draft grammar for now.

In the current TypeScript implementation, `@matra/core` `parse()` returns this
syntax tree. `evaluateStatic()` retrieves static documents without execution,
and the explicit `evaluateUnified()` API evaluates the implemented procedural
subset. Assignment, import/export, and type syntax remain rejected rather than
silently assigned another meaning.

## Evaluation modes

`evaluateUnified()` supports `fn`, `return`, `if` / `else`, and array `for`
loops. Selected branches and loop iterations contribute their expression
results to a node body in source order; declarations contribute no child.
Import/export, typing, and assignment remain out of scope.
`else` may start on the line following the closing `}` of its `if` body.

## Source and top level

A source is a sequence of statements separated by a newline or `;`. `let` is a
declaration and creates no output. Every other top-level expression is an
output expression; the static evaluator currently returns the final expression.

```matra
let title = "Matra"
article { h1 { title } }
```

## Expressions and nodes

An ordinary call is `name(arguments)` and member access is `object.member`.
Node construction always has a body: `tag.classes(attributes) { statements }`.
`=` separates attributes; `:` separates object entries. Classes preserve first
appearance order and discard duplicates.

```matra
a.link(href=page.url) { page.title }
chart(options={theme: "dark"}, series=[10, 20]) {}
```

An expression result in a node body becomes a child in source order. `let` does
not add a child. Arrays and objects are neither implicitly expanded nor
stringified as children.

The implemented expression operators are grouping `(...)`, prefix `!` and `-`,
then `*` and `/`, `+` and `-`, comparisons (`==`, `!=`, `<`, `<=`, `>`, `>=`),
`&&`, and `||`, from highest to lowest precedence. Numeric literals never
contain a sign: a negative number is parsed using prefix `-`, so `5 - 2` and
`-2 + 3` are unambiguous.

## Static retrieval

Literals, arrays, objects, preceding static `let`s, and nodes containing only
those forms can be retrieved without executing a program. References, member
access, calls, operators, and procedural statements raise `EvaluationRequired`;
static retrieval must not fall back to execution.

## Open questions

The following are deliberately unimplemented: import/module resolution, string
escapes and multiline strings, merging explicit `class` with shorthand,
duplicate attributes, renderer treatment of scalar/null children, scope and
mutability, inference, line continuation, and the Wasm value representation.

The recommended policy is to space-join and stable-deduplicate explicit and
shorthand classes, reject duplicate attributes, and give scalar/null document
semantics explicitly to each renderer.
