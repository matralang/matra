# Matra Program: for syntax proposal

[English](./for-loop-proposal.md) | [日本語](./for-loop-proposal.ja.md)

This is an unimplemented, non-normative proposal for Matra Program and compiler
source. [Matra Program](./program.md) remains authoritative, and
`fn name(parameters) -> type` is preserved.

## Recommended syntax

```matra
let (total = 0)
for (let (i = 0); i < 3; set (i = i + 1)) {
  set (total = total + i)
}
```

```ebnf
for          = "for", "(", initializer, ";", expression, ";", update, ")", block ;
initializer  = "let", "(", binding, ")" | update ;
update       = "set", "(", identifier, "=", expression, ")" ;
```

Reuse ordinary parenthesized `let` / `set` and expressions. An initializer can
use `set (i = 0)` with an existing local. Initially require all three components;
do not add legacy `let i = 0` or `i = i + 1` forms inside the header. Existing
legacy statements remain accepted elsewhere. Whitespace and line comments may
separate tokens; semicolons delimit components within this header.

## Execution and data model

Execute the initializer once, then execute the body, update, and condition in
that order while the condition is nonzero. The initializer runs even when the
first condition is zero. `break` exits the innermost loop without executing the
update. `return` and traps also skip the update. Design `continue` separately.

Reuse existing function-local binding and local-index rules without adding a
new block scope. After the example, `total == 3` and `i == 3`. Restrict updates
to `set` on existing locals, without introducing assignment expressions that
return values or new mutation operators.

Represent parsing as `For(initializer, condition, update, body)`, then lower to
the initializer and an existing `while`. Appending the update to the while body
allows reuse of existing break frames. In the self-hosted compiler, parse,
length, and writer must use the same header boundaries.

## Compatibility and rollout

Reserving `for` is a v0.x breaking change for source using that identifier.
Before implementation, list affected examples, tests, and README references,
and document migration in both authoritative language versions. Preserve the
existing syntax of `fn`, `let`, `set`, `while`, and `do-until`.

Roll out the specification, Rust seed, and self-hosted compiler in that order.
Design `i++` / `++i` later as a separate change: their result values, evaluation
order, and assignable targets need independent definitions.

## Required validation

- One initializer execution; zero, one, and many body executions; update order and count.
- Updates skipped by `break` / `return`; innermost exit across while and do-until nesting.
- Header and subsequent local indices, typed let, and initialization of an existing local.
- Header comments, call argument parentheses, arithmetic, and comparison conditions.
- Rejection of missing semicolons, closing parentheses or bodies, empty components, let updates, and `i++`.
- Diagnostics at the following token or EOF for missing syntax.
- Focused execution tests, Stage 2/3 byte equality, all seed tests, lint, and diff checks.
