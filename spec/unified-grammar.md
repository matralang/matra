# Matra unified grammar v0.3 draft

[日本語](./unified-grammar.ja.md) | [Index](./README.md)

## Status and compatibility

This proposed specification covers both general `.matra` programs and compiler source.
As a breaking v0.x change, it removes Core v0.2 function nodes, selector `#id`, backtick/tilde text,
`$root`, `= expr`, and implicit child expansion by if/for.
Legacy `.matra.program` remains a compatibility entry point. Compiler source uses the `compiler.matra` fence.
Migration covers core/seed parsers, evaluators, tests, document.matra, the procedural Playground example, and seed READMEs.

TypeScript `parse()` and Rust seed parse the unified syntax. `evaluateStatic()` retrieves static documents;
`evaluateUnified()` explicitly executes programs. Rust seed and the self-hosted compiler generate document Wasm.
Bootstrap verification checks Stage 2/3 byte equality and shared grammar execution tests for every Stage.

## Canonical forms and separators

The canonical forms are `let (x = value)`, `if (condition) { ... }`, `while (condition) { ... }`,
and `for (item in items) { ... }`. Omitting parentheses produces the same syntax tree and meaning.
In an unparenthesized condition or iteration header, the first `{` outside nested delimiters starts the body.
A node/object directly at that position requires parentheses. Unparenthesized headers cannot continue across lines.
Parentheses permit newlines and line comments. Call, function parameter, and until parentheses remain mandatory.
Parsing does not fall back to another interpretation after an error.

Statements are separated by LF or `;`; the separator may be omitted immediately before `}` or EOF.
Spaces, tabs, and CR do not separate statements. `//` comments end at LF or EOF, retaining LF as a separator.
Array/object/call elements may span lines. Trailing commas, string escapes, and multiline strings are rejected.
Syntax errors such as missing delimiters point to the next token or EOF. Rust records UTF-8 byte offsets;
the host converts them to line/column positions. `else` may begin on the next line after its matching `}`.

```ebnf
source = { statement, ( newline | ";" ) }, [ statement ] ;
statement = expression | let | assignment | function | return | break ;
let = "let", ( "(", binding, ")" | binding ) ;
binding = identifier, "=", expression ;
assignment = identifier, "=", expression ;
function = "fn", identifier, "(", [ identifier, { ",", identifier } ], ")", block ;
return = "return", expression ;
break = "break" ;
block = "{", source, "}" ;
if = "if", header, block, [ "else", block ] ;
while = "while", header, block ;
header = "(", expression, ")" | bare-expression ;
for = "for", ( "(", iteration, ")" | bare-iteration ), block ;
iteration = identifier, "in", expression ;
do-until = "do", block, "until", "(", expression, ")" ;
call = expression, "(", [ expression, { ",", expression } ], ")" ;
node-item = statement | "...", expression ;
```

Expressions include if, for, while, and do-until. Bare expressions/iterations obey the newline and body-start rules
above. Node items are allowed only directly in a node body.

## Expressions and nodes

Any function or constructor can return any value through `name(args)`. Names receive no special treatment.
Node construction requires a body: `tag.classes(attributes) { node-items }`.
`=` separates attributes; `:` separates object entries. Classes are deduplicated in first-occurrence order.
Attribute names, object keys, member names, and class names may use reserved words, e.g. `label(for="x") {}`.
Variable, function, and parameter names reject reserved words.
Passing a trailing block to an ordinary function is outside this change.

```matra
fn rational(n, d) { {numerator: n, denominator: d} }
let (value = rational(3, 5))
a.link(href="/") { value.numerator }
```

Expressions include literals, references, arrays, objects, member access, calls, nodes, and control expressions.
Operator precedence, highest first: grouping `(...)`, prefix `!`/`-`, `*`/`/`, `+`/`-`,
comparisons `==`/`!=`/`<`/`<=`/`>`/`>=`, `&&`, then `||`. `&&` and `||` short-circuit.
Number literals exclude their sign; negative values parse as prefix `-` expressions.

If returns the selected block's value, or null when false without an else.
For returns an array of completed iteration block values. Zero iterations yield an empty array;
an iteration exited by break contributes no value. While/do-until return null.
A block/source returns its final expression's value, or null when empty or ending in a declaration/assignment.

Let creates mutable bindings. Each block has lexical scope. Duplicate declarations in the same scope are errors;
inner scopes may shadow bindings. Assignment updates the nearest existing binding; undeclared assignment is an error.
Functions capture their declaration scope and create a parameter scope per call.
Return exits the innermost function; break exits the innermost loop. Return outside functions and break outside loops
are rejected.

Each node-body expression adds exactly one child. Declarations and assignments add none.
`...expression` expands an array by one level and rejects non-arrays. Ordinary arrays/objects remain single children.
Null is retained in the value model and produces no output in HTML/SVG renderers.

```matra
let (rows = for item in [1, 2] { li { item } })
ul { ...rows }
let label = if (true) { "yes" } else { "no" }
```

Accepted: `let x = 1`, `if ready {}`, `for (x in [1, 2]) { x }`.
Rejected: a condition continued after `if x +` on the next line, `let (x = 1`, `f 1`, `...items` outside a node,
`p { "a" "b" }`, and attributes without a body, such as `p(href="/")`.
In `if ready {}`, ready is a variable reference, not a node constructor.
Shared acceptance, rejection, boundary, and execution tests live in [fixtures/unified.json](./fixtures/unified.json).

## Static retrieval

Literals, arrays, objects, preceding static let bindings, nodes composed from these, and static array child expansion
can be retrieved statically. Unresolved references, member access, calls, operators, control expressions, and assignments
produce `EvaluationRequired`. Static retrieval never falls back to execution.

## Compiler source native profile

`module name` selects the native compiler profile; ordinary documents use the host value profile.
There is no implicit conversion between profiles. The native profile retains the i32/bytes/[i32]/struct pointer ABI.
[compiler.md](../crates/matra-seed/examples/compiler.md) and bootstrap verification define compiler-source support.

The native profile adds module, import, struct, typed fn, and export fn.
Parameter and return types are mandatory; it uses existing integer operations and memory intrinsics.
The document profile and TypeScript evaluator reject type annotations and module/import/export/struct.
Native backend values are i32 and related types; document control-expression values using null/arrays are outside
this profile. Functions use explicit return. Compiler source itself uses this typed subset.

```ebnf
module = "module", identifier ;
import = "import", identifier ;
type = "i32" | "bytes" | "[", "i32", "]" | identifier ;
parameter = identifier, ":", type ;
function = [ "export" ], "fn", identifier, "(", [ parameter, { ",", parameter } ], ")", "->", type, block ;
struct = "struct", identifier, "{", { identifier, ":", "i32", [ newline | ";" ] }, "}" ;
```

Compiler artifacts also export `workspace_pages(sourcePointer, sourceLength)`. After placing the input,
the host grows memory by the returned page count before calling `compile` with its 36-byte result ABI.
The estimate includes the document frontend AST arena and emission buffers.

### Provisional host value ABI v1

Document Wasm exports `run() -> i32` and `memory`. Helpers in the `matra` import namespace manage strings,
numbers, booleans, null, arrays, objects, and nodes as opaque i32 handles. Zero means no output; null is a separate value.
Functions, branches, loops, and short-circuit operators execute in Wasm. The host grants no filesystem/network capability.
`host/unified-host.mjs` provides `instantiateUnified()` to supply imports and recover results.
This ABI is experimental and does not change the native compiler ABI.

All helpers take i32 arguments and return i32. `literal(pointer, length)` decodes UTF-8 JSON from exported memory.
`scope(parent)`, `bind(scope, name, value)`, `assign(scope, name, value)`, and `get(scope, name)` manage bindings.
`array()`/`push(array, value)`, `object()`/`property(object, key, value)`, `member(value, key)`, and
`node(tag, props, children)` construct/access values. Other helpers are `unary(operator, value)`,
`binary(operator, left, right)`, `truthy(value)`, `length(array)`, `item(array, index)`, and `spread(array, values)`.
`function(index, scope)` and `call(function, arguments)` invoke `(scope, arguments) -> value` functions in the
exported `__functions` table. Scope and value handles occupy separate domains.
Truthy/length/index use raw i32; other operands use value handles.
Values and scopes live for the instance lifetime; long-running garbage collection is not implemented.
Member access only reads own properties, never the prototype chain.

## Deferred decisions

Document module/import resolution, string escapes/multiline strings, combining explicit class attributes with shorthand,
a unified duplicate-attribute rule, type inference, general trailing-block calls, continuation outside parentheses,
and a stable Wasm value representation remain deferred.
