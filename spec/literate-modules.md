# Multilingual literate programming in Markdown (design proposal)

[English](./literate-modules.md) | [日本語](./literate-modules.ja.md) | [Index](./README.md)

## Status and scope

This document separates the initial implementation contract from future design proposals.
It is not a formal grammar specification. Only the explicit entry and `.js.part` subset below is
implemented; the later `.js`, npm, and Python examples remain proposals.
It supplements the [common runtime roadmap](./portable-runtime.md) without adding
npm or Python integration to the v0.3 minimal implementation.

The scope is loading Markdown documents containing ordinary Matra Programs, module resolution,
language interoperation, and developer tooling. Changes to Matra compiler source grammar are out of scope.
The dedicated CLI is an additive change; existing source, APIs, ABIs, AST/data models,
parsers, and CLI behavior are unchanged.
The [unified grammar](./unified-grammar.md) and existing compiler source bootstrap contracts remain intact.
Questions outside the initial contract remain for later stages.

## Initial implementation contract

This is host interoperation for ordinary Matra Programs, not a change to Matra or compiler source
grammar. It uses existing member/call syntax, document generation, and the host value ABI.

```text
pnpm literate -- build ROOT DOCUMENT.md main.matra OUTPUT.json --value datasets/sales.js.part --value analytics/total.js.part
pnpm literate -- run ROOT OUTPUT.json
```

Only the explicitly selected single `.matra` virtual file is the entry. Repeated `--value` options
select dependencies. Unselected blocks are never initialized or executed. There is no implicit import
or physical file lookup. `ROOT` and physical paths follow the
[portable runtime path contract](./portable-runtime.md).
Build produces a versioned JSON bundle containing Wasm, selected expressions, and source locations.
Run writes the document data model as one JSON line to stdout; non-JSON document results such as
functions are errors.
The [executable sample](../crates/matra-seed/examples/literate-values.md) produces a document containing
the total `60`. Run regressions with `node --test crates/matra-seed/tests/literate-runtime.test.mjs`.

### Virtual files and formats

- Fences open with zero to three spaces and at least three backticks or tildes. Closing delimiters
  use the same character, at least the opening length, followed only by spaces/tabs.
  CRLF is normalized to LF. Body line numbers are retained; unclosed fences are errors.
  Examples nested inside an outer fence are not scanned again as virtual files.
- The entire trimmed info string is a single filename. Language labels without an extension are
  explanatory. Paths use `/`; components are ASCII identifiers optionally followed by dot suffixes.
  Reject `.`, `..`, empty components, absolute paths, backslashes, and queries.
  Paths are case-sensitive, but case-only duplicates are also rejected.
- Registration rejects duplicate paths across all named fences. `.js` and `.js.part` register distinct
  formats, removing the whole suffix and mapping path separators to dots for public names.
  Equal or ancestor/descendant public names (`a` and `a.b`) conflict even in unselected blocks.
- Only `.matra` entries and `.js.part` values can be selected. Standard `.js` modules, other formats,
  and `?values` headers are diagnosed as unsupported, never inferred from the body.
  A public root colliding with a Matra binding uses the existing duplicate-binding diagnostic.
- A `.js.part` body is syntax-checked as one parenthesized JavaScript expression in strict mode.
  Object/function/arrow expressions, newlines, and JavaScript comments are accepted.
  Import/export declarations, multiple statements, and trailing semicolons are rejected without fallback.

### Registration, build, and execution

Registration validates names, collisions, and selection. Build only syntax-checks selected expressions
and compiles Matra to Wasm. Neither executes user expressions or function bodies.
At runtime, selected values initialize exactly once in ascending ASCII path order, before the entry.
Function bodies execute only when called. Each run creates a fresh JavaScript context and values;
closure state persists only within that run. Expressions share that fresh context, but public names
and Matra bindings are not injected into JavaScript.
Only standard synchronous JavaScript built-ins are intended; Node.js `process`, `require`, timers,
imports, string code generation, and Wasm generation are not provided.
This is not an OS sandbox or a timeout guarantee: execute trusted documents only.
The initial implementation offers Wasm execution only, not a second interpreter mode.
Future modes must share these initialization/call semantics without build-time evaluation.

### Value boundary and diagnostics

Recursively copy `null`, booleans, finite numbers, strings, dense arrays, and plain objects with own
enumerable string-keyed data properties. JavaScript-to-Matra values may also contain functions.
Arguments passed from Matra are copied; JavaScript mutations do not update Matra data.
Return values are copied too. Aliasing is not preserved. Reject cycles, accessors, symbol keys,
non-enumerable properties, sparse arrays, custom prototypes, `undefined`, BigInt, non-finite numbers,
and Promises/thenables. Document nodes can cross as plain data; there is no special conversion
for math, binary data, or class instances. Matra function arguments and asynchronous work are unsupported.
JavaScript functions receive `undefined` as `this`; calling non-functions is an explicit existing host error.
Document output accepts only the data subset above, not functions.

The loader reports `LiterateError.code`, original document, virtual path, and body start line.
JavaScript causes/stacks retain original line/column locations. Matra compile diagnostics map to
original document lines. Matra runtime errors identify the entry block (expression-level source maps
are deferred). Duplicate, unsupported, missing, syntax, initialization, call, and boundary errors
must never become successful output. This section takes precedence over later proposals for the initial release.

## Core policy

> Let people write as briefly as possible when they want brevity, and explicitly when they want precision.

- Use Markdown as the entry point for explanations and code.
- Treat named code blocks as virtual files, making use of paths and extensions.
- Keep JavaScript as JavaScript. Do not introduce a JavaScript dialect inside Matra
  as a way to achieve npm compatibility.
- Treat JavaScript expressions as values, exposing datasets, objects, arrays, and numbers as well as functions.
- Give the value form a corresponding explicit export form with the same public name and value usage contract.
- Connect languages through explicitly exposed values rather than implicitly sharing all variables.
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

JavaScript blocks have an explicit module form and a value form exposing the value of one expression.
The value form treats the entire body as a value definition, much as JSON represents data,
not as a series of module declarations.
A function is one kind of value; this is not a shorthand mechanism specifically for functions.
The parameter-header form is shorthand for defining a function value returning the expression.

Select the form by virtual filename rather than guessing from the body.

| Filename | Body interpretation |
| --- | --- |
| `foo.js` | Standard JavaScript module |
| `foo.js.part` | Value represented by one JavaScript expression |
| `foo.js.part?values` | Function value taking `values` and returning the body expression |

`.js.part` denotes an expression fragment; remove the entire suffix when constructing public names.
For example, `analytics/total.js.part` exposes `analytics.total`.
Do not adopt `.partial.js` as an alias. Ordinary `.js` does not implicitly switch to the value form,
and `.js.part` does not accept import/export declarations as a module.
If the two forms produce the same public name, apply the collision rule described above.

The following function examples all expose the same function as `analytics.total`.
The value form and parameter headers are Markdown loader rules, not standard JavaScript module syntax.
They require expansion to an explicit export form when extracted into ordinary `.js` files.

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

### 2. Value form: one JavaScript expression

````markdown
```analytics/total.js.part
function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```
````

Interpret the entire body as one JavaScript expression and expose its evaluated value at the corresponding path.
The example above defines a function expression as a value; arrow functions follow the same model.

````markdown
```analytics/total.js.part
values => values.reduce((sum, value) => sum + value, 0)
```
````

A standalone anonymous `function (values) { ... }` is not a valid statement in a standard JavaScript module,
but it is a valid function expression in the value form.
The explicit counterpart can be expressed as `export default <expression>`.
This describes corresponding public contracts, not interpreting the value-form body as a module.

The design supports datasets and numbers as well as functions.

````markdown
```datasets/sales.js.part
[
  { label: "A", amount: 10 },
  { label: "B", amount: 20 }
]
```

```settings.js.part
{ title: "Sales", scale: 2 }
```

```constants/taxRate.js.part
0.1
```

```main.matra
let rows = datasets.sales
p { settings.title }
for (row in rows) {
  p { row.amount }
}
p { constants.taxRate }
```
````

An object's `{ ... }` is an expression, not a statement block.
The value form covers arrays, objects, numbers, strings, booleans, null, and similar values;
only function values are callable.
The intended experience resembles JSON, but does not use a JSON parser or serialize values to JSON.
JavaScript expressions can have side effects such as function calls, so they do not guarantee static-data safety.
Specify evaluation timing and frequency, sharing and mutability, and names available to expressions before implementation.
Distinguish module and value forms by filename as described above.
Do not retry a different form as a fallback after a syntax error.

### 3. Parameter-header and expression shorthand

````markdown
```analytics/total.js.part?values
values.reduce((sum, value) => sum + value, 0)
```
````

- `analytics/total.js.part` is the virtual file path.
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

## Compilation and evaluation semantics

Compilation and interpretation must not change evaluation order or side-effect semantics for the same program.
Compilation performs parsing, validation, and code generation; it does not mean executing user
expressions or module initialization at build time.
These evaluations happen at runtime.

Distinguish three phases:

1. Name registration: collect virtual file paths and public names without executing user code in the bodies.
2. Value initialization: evaluate expressions to create data or function values, or initialize modules.
   Side effects can occur in this phase.
3. Function invocation: execute the body of an exposed function.

JavaScript function declaration hoisting does not mean evaluating all code at the start.
A function declaration can be called before its declaration in the same scope, but its body runs on invocation.
For function expressions and arrow functions, also distinguish creating a function value from running its body.
Registering a name does not imply its value has been initialized.

The specific initialization order and frequency, dependencies and forward references,
cyclic dependencies, and state across reruns remain undecided.
Selecting compilation or interpretation must not implicitly switch these rules.

## Execution selection and developer experience

The presence of filename-based fences must not automatically execute all code in a document.
Distinguish explanatory examples from executable code and define entry points, dependencies,
duplicate paths, and initialization order.
Make permission approval and environment constraints explicit; neither virtual files nor Wasm is an OS sandbox.

Developer tooling should identify languages by extension and recognize parameter headers.
Ordinary Markdown tools may not automatically highlight `analytics/total.js.part?values` as JavaScript.
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

1. Implement named virtual files, explicit entry selection, and synchronous selected `.js.part` values/functions (initial release).
2. Consider standard JavaScript modules, imports/npm dependencies, and parameter headers in separate stages.
3. Complete dependency management, error mapping, completion, and debugging support.
4. Independently design and validate Python integration against the calling contract.

Add at least the following regression tests:

- Calling all three forms and the named-export form from Matra produces `60`.
- Matra can use arrays, objects, numbers, strings, booleans, and null from value-form blocks,
  referring to datasets without turning them into functions. Calling non-functions fails explicitly.
- Verify generated modules and Matra document output, not just successful parsing.
- Reject colliding public names, duplicate virtual paths, invalid paths, and missing modules or exports.
- Reject `return` statements, multiple statements, and invalid JavaScript in the parameter-header form,
  without fallback to another form or implicit success.
- Do not execute explanatory blocks; follow dependencies even when blocks are reordered.
- Report exceptions, asynchronous failures, and initialization failures according to the contract
  and at original Markdown locations.
- Test comments, line breaks, delimiters, and boundaries between value and module forms.
- Test classification by `.js` and `.js.part`, public names with suffixes removed, and name collisions between forms.
- Do not execute user code during name registration or compilation.
  Verify that both execution approaches have the same specified initialization order, side effects, and results.
- Preserve existing Matra document and compiler source fence selection and execution.

Assess parser, AST/data model, lowering, runtime, and diagnostic effects individually;
do not change unaffected layers. Label incompatible implementations as v0.x breaking changes
and enumerate affected examples, tests, READMEs, and migration documents.
If compiler/bootstrap behavior is affected, verify the Rust seed and Stages 1/2/3
and preserve byte equality of Stage 2/3 generated Wasm.
