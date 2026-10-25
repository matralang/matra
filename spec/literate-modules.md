# Multilingual literate programming in Markdown (design proposal)

[English](./literate-modules.md) | [日本語](./literate-modules.ja.md) | [Index](./README.md)

## Status and scope

This document proposes a future design, not an implemented feature or a formal grammar specification.
The multilingual examples below cannot be executed with the current CLI.
It supplements the [common runtime roadmap](./portable-runtime.md) without adding
npm or Python integration to the v0.3 minimal implementation.

The scope is loading Markdown documents containing ordinary Matra Programs, module resolution,
language interoperation, and developer tooling. Changes to Matra compiler source grammar are out of scope.
This documentation-only change does not alter existing source, APIs, ABIs, AST/data models,
or parser, runtime, and diagnostic behavior.
The [unified grammar](./unified-grammar.md) and existing compiler source bootstrap contracts remain intact.
Resolve the open questions below and compatibility with existing fence selection before implementation.

## Core policy

> Let people write as briefly as possible when they want brevity, and explicitly when they want precision.

- Use Markdown as the entry point for explanations and code.
- Treat named code blocks as virtual files, making use of paths and extensions.
- Keep JavaScript as JavaScript. Do not introduce a JavaScript dialect inside Matra
  as a way to achieve npm compatibility.
- Give each shorthand a corresponding explicit form with the same public name and calling contract.
- Connect languages through explicitly exposed functions rather than implicitly sharing all variables.
- Connect execution through dependencies, without unnecessarily depending on the narrative order of blocks.

## Named fences as virtual files

The following proposed example uses a regular JavaScript module.

````markdown
```analytics.js
export function total(values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```

```main.matra
let result = analytics.total([10, 20, 30])
p { result }
```
````

`analytics` is not a reserved word: it comes from the path `analytics.js` without its extension.
`total` comes from the JavaScript named export. Neither depends on the Markdown filename.
Here, `main.matra` illustrates a possible entry point, not a finalized automatic execution rule.
The intended Matra result is a document node containing `60`.

The design also allows a default export when splitting files by functionality.

````markdown
```analytics/total.js
export default function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```

```main.matra
let result = analytics.total([10, 20, 30])
p { result }
```
````

| Virtual file | Exposed value | Reference in Matra |
| --- | --- | --- |
| `analytics.js` | Named export `total` | `analytics.total(...)` |
| `analytics/total.js` | Default export | `analytics.total(...)` |

The latter maps path components to namespaces and assigns the default export to the leaf name.
This is an interoperation rule for Matra, not a change to standard JavaScript import semantics.
Multiple definitions producing the same name are errors, not order-dependent overwrites or implicit merges.
For example, placing both definitions above in the same resolution scope causes an `analytics.total` collision.

The examples illustrate directly referencing `analytics` from the same document.
The actual visibility scope and whether explicit imports are an option remain undecided.
The goal is to retain paths and public contracts when extracting blocks into physical files,
but lookup rules and precedence between virtual and physical files must be specified before implementation.

## Explicit form and shorthands

The following three forms are intended to expose the same function as `analytics.total`.
Shorthands are Markdown loader rules, not standard JavaScript module syntax.
They require expansion to the explicit form when extracted into ordinary `.js` files.

### 1. Explicit form: a standard JavaScript module

````markdown
```analytics/total.js
export default function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```
````

The module form allows ordinary imports, named exports, and multiple declarations.
How a mixture of default and named exports is exposed to Matra remains undecided.

### 2. Function-expression shorthand

````markdown
```analytics/total.js
function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```
````

When the entire block is one function expression, treat that function as the default export.
Arrow functions are also candidates.

````markdown
```analytics/total.js
values => values.reduce((sum, value) => sum + value, 0)
```
````

A standalone anonymous `function (values) { ... }` is not a valid statement in a standard JavaScript module.
The loader treats it as a function expression and expands it to the explicit form.
Specify how to distinguish module and function-expression forms before implementation.
Do not retry a different form as a fallback after a syntax error.

### 3. Parameter-header and expression shorthand

````markdown
```analytics/total.js?values
values.reduce((sum, value) => sum + value, 0)
```
````

- `analytics/total.js` is the virtual file path.
- `?values` declares the function parameter; it is neither a URL query value nor a call argument.
- The body is one JavaScript expression whose evaluation supplies the return value.
- `?values` is excluded from module identity and public names.

This example expands to the explicit `export default function (values) { return ... }` form.
The body is not a function body, so this form does not accept a `return` statement or multiple statements.
Use a function expression or explicit module when multiple statements are needed.
Syntax for multiple parameters, no parameters, defaults, destructuring, rest parameters, and async remains undecided.
Specify handling of object expressions, line breaks, comments, and trailing semicolons before implementation.

## Common runtime and language responsibilities

```text
Markdown
  └─ Collect named blocks and resolve modules
       ├─ Matra → compiler → Wasm
       ├─ JavaScript → JavaScript module
       └─ Python → Python runtime (future)
                    ↕
             Common calling contract
```

The common runtime handles startup, dependencies, public function connections, and error propagation.
Compiling every language to Wasm is not required.
The Node.js host and existing
[provisional host value ABI](../crates/matra-seed/host/unified-host.mjs) can provide a starting point,
but the existing ABI is not thereby guaranteed as a stable common protocol.
Decide on WASI and the Component Model separately.

The direction is to use npm assets through standard imports inside JavaScript blocks,
after defining dependency declarations, locking, supported versions, and resolution bases.
This does not guarantee compatibility with arbitrary npm packages or native addons,
identical behavior on three OSes, or operation on the Web.
Python is a future extension; runtime and package integration mechanisms remain undecided.

Define argument and result support for numbers, strings, arrays, objects, document nodes, mathematical
expressions, large integers, binary data, and function references, including copy versus sharing semantics.
The contract must also cover exceptions, asynchronous execution, timeouts, cancellation,
module initialization, and cyclic dependencies.
Do not assume that current synchronous host calls automatically await JavaScript Promises.

## Execution selection and developer experience

The presence of filename-based fences must not automatically execute all code in a document.
Distinguish explanatory examples from executable code and define entry points, dependencies,
duplicate paths, and initialization order.
Make permission approval and environment constraints explicit; neither virtual files nor Wasm is an OS sandbox.

Developer tooling should identify languages by extension and recognize parameter headers.
Ordinary Markdown tools may not automatically highlight `analytics/total.js?values` as JavaScript.
Connect completion, import resolution, type checking, formatting, and debugging to existing language tools.
Include shorthand parameters in completion and analysis.
Maintain mappings between original Markdown and generated modules rather than relying on fixed
offsets into generated code; map syntax and runtime errors to the original block's lines and columns.
Consider tooling for expanding shorthands and extracting physical files.

## Decisions and verification before implementation

The examples in this document are proposed accepted cases, not evidence of passing conformance tests.
Alongside the open questions above, specify path bases, permitted names, case and Unicode normalization,
extensions, the `?` separator, and fence whitespace, comment, and delimiter contracts in both languages.
Make the relationship to the common runtime's existing logical path contract explicit.

Implement incrementally:

1. Implement named virtual files, entry selection, and exposure/calling of standard JavaScript modules.
2. Implement function-expression and parameter-header shorthands using unambiguous classification rules.
3. Complete dependency management, error mapping, completion, and debugging support.
4. Independently design and validate Python integration against the calling contract.

Add at least the following regression tests:

- Calling all three forms and the named-export form from Matra produces `60`.
- Verify generated modules and Matra document output, not just successful parsing.
- Reject colliding public names, duplicate virtual paths, invalid paths, and missing modules or exports.
- Reject `return` statements, multiple statements, and invalid JavaScript in the parameter-header form,
  without fallback to another form or implicit success.
- Do not execute explanatory blocks; follow dependencies even when blocks are reordered.
- Report exceptions, asynchronous failures, and initialization failures according to the contract
  and at original Markdown locations.
- Test comments, line breaks, delimiters, and boundaries between shorthand and module forms.
- Preserve existing Matra document and compiler source fence selection and execution.

Assess parser, AST/data model, lowering, runtime, and diagnostic effects individually;
do not change unaffected layers. Label incompatible implementations as v0.x breaking changes
and enumerate affected examples, tests, READMEs, and migration documents.
If compiler/bootstrap behavior is affected, verify the Rust seed and Stages 1/2/3
and preserve byte equality of Stage 2/3 generated Wasm.
