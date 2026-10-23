# Matra unified grammar v0.3

[日本語](./unified-grammar.ja.md) | [Index](./README.md)

## Status and compatibility

This is the finalized v0.3 grammar specification for both general `.matra` programs and compiler source.
Its rules and shared tests define conformance. Compatibility with old source is not guaranteed.
Finalizing the grammar does not constitute a package release or stabilize the Wasm ABI.
As a breaking v0.x change, it removes Core v0.2 function nodes, selector `#id`, backtick/tilde text,
`$root`, `= expr`, and implicit child expansion by if/for.
The legacy `.matra.program` entry point remains implemented but is not a v0.3 conformance requirement.
Compiler source uses the `compiler.matra` fence.
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
if = "if", header, block, { "else_if", header, block }, [ "else", block ] ;
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
Attributes and object entries are evaluated in source order; the last value for a duplicate key wins.
When class shorthand is present, its deduplicated names joined by spaces overwrite an explicit class attribute.
Without shorthand, the explicit class attribute is retained unchanged.
Passing a trailing block to an ordinary function is not accepted in v0.3.

Parenthesized node attributes may be separated by whitespace/newlines as well as commas.
This compatible extension applies to the document profile of ordinary Matra Programs;
the native compiler-source grammar is unchanged. Values remain complete expressions, not just strings.
The next `attribute-name =` starts the next attribute. When omitting a comma, space/tab/CR/LF must
immediately precede the next attribute name. Whitespace, newlines, and line comments are allowed between
the name and `=`. The LF after a line comment may separate attributes.
Comma and whitespace separators may be mixed; trailing commas remain rejected.
Commas remain required in calls, parameters, arrays, and objects. Markup attributes are unchanged.

```ebnf
node-attributes = attribute, { ( "," | attribute-space ), attribute } ;
attribute = identifier, "=", expression ;
attribute-space = ( " " | tab | CR | LF ), { " " | tab | CR | LF } ;
```

Interpret EBNF whitespace together with ordinary inter-token trivia.
Accepted: `img(src="image.png" alt="image") {}`,
`p(title="Hello " + name lang="ja", count=1 + 2) {}`.
Rejected: `p(a="x"b="y") {}`, `p(a=1 2) {}`, `f(1 2)`, `[1 2]`, `{a: 1 b: 2}`.
A missing separator points at the next attribute name; a missing value points at the next token or EOF.
The AST, evaluation order, last-key-wins behavior, class precedence, and value model are unchanged.
Shared fixtures verify acceptance, rejection, expression boundaries, and execution across all Stages.

```matra
fn rational(n, d) { {numerator: n, denominator: d} }
let (value = rational(3, 5))
a.link(href="/") { value.numerator }
```

Expressions include literals, references, arrays, objects, member access, calls, nodes, and control expressions.
Operator precedence, highest first: grouping `(...)`, member access/calls, prefix `!`/`-`, `*`/`/`, `+`/`-`,
relational comparisons `<`/`<=`/`>`/`>=`, equality `==`/`!=`, `&&`, then `||`.
Binary operators of equal precedence associate to the left. `&&` and `||` short-circuit.
Number literals exclude their sign; negative values parse as prefix `-` expressions.

If returns the selected block's value, or null when false without an else.
`else_if` attaches to the immediately preceding `if` / `else_if`; `else` ends the chain.
Only whitespace, newlines, and line comments may intervene, not another statement or `;`.
Conditions are evaluated in order. Only the first matching body executes; subsequent conditions are skipped.
The entire chain is one expression, returning null if no condition matches and there is no else.
An `else_if` header follows the same parentheses, newline, and delimiter rules as an `if` header.
Orphan `else_if` / `else`, branches following else, empty conditions, and missing bodies are rejected.
Syntax errors point to the next token or EOF.
The AST nests existing if expressions in else bodies, without introducing runtime branch state.

```matra
let (label = if (score >= 80) {
  "high"
}
else_if (score >= 50) {
  "middle"
}
else {
  "low"
})
```

This extension covers both general Matra Programs and native compiler source.
Existing branches remain supported, but reserving `else_if` is a v0.x breaking change for sources using it
as a variable, function, parameter, or node tag; rename these identifiers.
Attribute, object key, member, and class names may still use it.
Existing examples, tests, and READMEs do not use this identifier.

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

## XML-style markup

The document profile of ordinary Matra Programs adds XML-style markup expressions.
Existing `tag(attrs) { ... }`, calls, comparisons, and division remain supported.
The `<>` delimiters make Matra node boundaries explicit; consistency with Matra takes priority over XML compatibility.
The native compiler-source grammar and ABI are unchanged.

```matra
let image = <img src="image.png" />
<p>Hello <strong>Matra</strong>!</p>
<a.matra-button href="/spec/">Read the spec</a>
```

```ebnf
markup = "<", markup-tag, { ".", markup-class }, { markup-space, markup-attribute }, [ markup-space ],
         ( "/>" | ">", { markup-text | markup }, "</", markup-tag, [ markup-space ], ">" ) ;
markup-attribute = markup-name, [ markup-space ], "=", [ markup-space ], markup-string ;
markup-space = ( " " | tab | CR | LF ), { " " | tab | CR | LF } ;
```

The character ranges and decoding rules for names, quoted `markup-string`, and `markup-text`
are defined below.

`<tag />` and `<tag></tag>` construct the same empty node. Opening and closing names must match,
including case. Markup normalizes to the existing node AST without adding a runtime value kind.
`markup-tag` matches `[A-Za-z_:][A-Za-z0-9_:-]*`, `markup-class` matches `[A-Za-z_][A-Za-z0-9_-]*`,
and attribute `markup-name` matches `[A-Za-z_:][A-Za-z0-9_.:-]*`; reserved words are allowed.
Namespace names and `xmlns` attributes are retained without URI resolution.

Opening names support the existing Matra `.class` shorthand. Whitespace, newlines, and comments
are not allowed between a tag and its classes or around `.`. Closing tags contain only the tag name:
`</a>`. Self-closing `<hr.divider />` is also accepted. Classes are deduplicated in first-occurrence
order and joined with spaces, overriding an explicit `class` attribute. Without shorthand, that attribute
is preserved. For example, `<a.button.primary.button class="other">Link</a>` has class `"button primary"`.
Shorthand is stored in the existing AST `classes` field and uses existing lowering/runtime behavior.

This is a v0.x breaking change. Previously `<a.b />` had tag `"a.b"`; it now has tag `"a"` and class `"b"`.
`<a.b></a.b>` is rejected; closing names never select an alternative interpretation.
Literal dotted tag names cannot be expressed in markup; use MatraJSON or another representation.
Dots in attribute names are unchanged. Full XML subset/superset compatibility is not guaranteed.
Affected surfaces are dotted-tag shared fixtures, markup parsers, READMEs, and document examples;
the native compiler-source grammar and historical archives are unchanged.

Attributes require separating space/tab/CR/LF; these characters are also allowed around `=`.
Values are single- or double-quoted strings without type inference or expression evaluation.
Duplicate attributes are rejected. Content consists of text and child elements; quotes, `{}`, `//`,
and newlines are ordinary text. Whitespace, newlines, and indentation are retained without normalization.
Contiguous text and character references form one string child; empty text children are omitted.
Matra expressions are not interpolated inside markup.

Text and attributes decode the five entities `amp`, `lt`, `gt`, `quot`, `apos` and decimal/hexadecimal
character references. References and literal characters must belong to the XML 1.0 character ranges:
tab/LF/CR, U+0020–D7FF, U+E000–FFFD, U+10000–10FFFF. Unknown or incomplete references,
literal `<` in attributes, and `]]>` in text are rejected.

Comments, CDATA, processing instructions, XML declarations, DOCTYPE, external entities, and HTML
tree-repair rules are initially unsupported and produce syntax errors. `<br>`, boolean/unquoted attributes,
omitted closing tags, `tag /`, and `<tag(attrs) />` are not accepted. `script`/`style` use ordinary
XML-style content rules. Adjacent markup expressions still require statement separators:
`<a /><b />` does not implicitly construct a fragment.

Diagnostics point at the first invalid character, a reference's `&`, a duplicate attribute name,
or the start of a mismatched closing name. Missing delimiters point at the next invalid character or EOF.
An empty/invalid class points at the expected class name; `.class` in a closing tag points at its `.`.
Parsing never falls back to another syntax. Shared fixtures verify execution through TypeScript,
Rust seed, and compiler Stages 1/2/3.

## Parsing and value model

For the document profile, `parse()`/`parseUnified()` consume the entire source and return a `UnifiedModule`
retaining declarations and expressions. A single root node is not required. Syntax errors never return partial success.
`evaluateStatic()`/`evaluateUnified()` accept a module and return the source result defined above.
Node values use `{tag, props, children}`; syntax trees are distinct from evaluated document values.
This finalization requires no implementation changes to parsers, syntax trees, lowering/runtime, or diagnostics.

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

## Outside v0.3

Document module/import resolution, string escapes/multiline strings, type inference, general trailing-block calls,
and continuation outside parentheses are not part of v0.3. Adding them requires a future specification change.
A stable Wasm value representation is independent of the grammar; the ABI above remains experimental.
