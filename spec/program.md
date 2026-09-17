# Matra Program v0.1 draft

[日本語](./program.ja.md) | [Index](./README.md)

## Purpose

Matra Program is an executable profile for implementing Matra tooling,
including the self-hosted compiler. Matra Core remains a domain-neutral tree
notation; this profile defines separate syntax and execution semantics.

A Markdown document is a source bundle. Each named `*.matra.program` fenced
code block is one module. The seed compiler compiles an entry block and its
imports to one WebAssembly module.

## Current seed subset

The seed compiler currently supports `i32` and `bytes` functions, local
variables, function calls, arithmetic, comparisons, `if` / `else`, `while`,
and `break`. It exports one page of WebAssembly linear memory. A `bytes`
parameter and return value lower to `(pointer, length)`, and parameters support
`byte_length(source)` and `byte_at(source, index)`.
`allocate_bytes(size)` allocates `bytes` in linear memory, and `byte_set(bytes,
index, value)` writes one byte. `byte_pointer(bytes)` returns its pointer.
`allocate_i32_array(size)`, `array_get(array, index)`, and `array_set(array,
index, value)` provide allocation and access for `[i32]`.

`bool` and a stable compiler ABI are specified as planned syntax below, but are
not yet implemented. The seed subset supports structs whose fields are all
`i32`: a struct value is a pointer to its fields in linear memory, constructors
use `name(value, ...)`, and fields are read with `value.field`. Field assignment,
nested structs, arrays of structs, and `bytes` fields are not implemented. The bootstrap compiler implements a
temporary subset of the ABI below.

## Source form

```matra
module example

import math

export fn answer(input: i32) -> i32 {
  let (result = double(input))
  while (result < 42) {
    set (result = result + 1)
  }
  return result
}
```

Use `snake_case` for identifiers. `fn`, `let`, `set`, `if`, `else`, `while`,
`do`, `until`, `return`, `break`, `module`, `import`, and `export` are reserved
words.

`()` groups expressions and declares or calls functions. `[]` is reserved for
array literals, indexing, and array types. `{}` delimits blocks and will also
delimit struct literals. Document Matra syntax is not embedded directly in a
Program block.

## Modules

Every Program block starts with `module name`. `import name` resolves a block
by its module name, not its fence filename. The selected entry and all of its
transitive imports are compiled together. Function names are currently global
within that import closure and MUST be unique.

When a Markdown document has multiple Program blocks, the caller MUST select
the entry fence.

```text
cargo run --manifest-path crates/matra-seed/Cargo.toml -- \
  source.md output.wasm --entry compiler.matra.program
```

## Draft grammar

Whitespace separates tokens; `//` starts a line comment. Newlines are
recommended between statements.

```ebnf
program    = module, { import }, { struct }, { function } ;
module     = "module", identifier ;
import     = "import", identifier ;
function   = [ "export" ], "fn", identifier, "(", [ parameters ], ")",
             "->", type, block ;
struct     = "struct", identifier, "{", { identifier, ":", "i32" }, "}" ;
parameters = parameter, { ",", parameter } ;
parameter  = identifier, ":", type ;
type       = "i32" | "bool" | "bytes" | "[", type, "]" | identifier ;
block      = "{", { statement }, "}" ;
statement  = let | set | assignment | byte_set | if | while | do-until | break | return ;
let        = "let", ( "(", binding, ")" | binding ) ;
binding    = identifier, [ ":", type ], "=", expression ;
set        = "set", "(", identifier, "=", expression, ")" ;
assignment = identifier, "=", expression ;
byte_set   = "byte_set", "(", expression, ",", expression, ",", expression, ")" ;
condition  = "(", expression, ")" | expression ;
if         = "if", condition, block, [ "else", block ] ;
while      = "while", condition, block ;
do-until   = "do", block, "until", "(", expression, ")" ;
break      = "break" ;
return     = "return", expression ;
```

New source SHOULD use `let (name = expression)` for local declarations and
`set (name = expression)` for assignment to an existing local. A type
annotation follows the identifier, as in `let (name: type = expression)`.
During migration, implementations MAY also accept `let name = expression` and
`name = expression` as equivalent statements.

The parentheses belong to the statement, not to its expression. Normal
whitespace and line comments may appear between `let` or `set` and `(` and
between tokens inside the parentheses. If the closing `)` is missing, the
parser MUST report the next token or the end of the source as the error
position. The target of `set` MUST be a previously declared local and cannot
include a type annotation.

```matra
let (count: i32 = 1)
set (count = count + 1)
```

The following is rejected because its closing `)` is missing.

```matra
let (count = 1
```

New source SHOULD parenthesize conditions as `if (condition)` and
`while (condition)`. During migration, implementations MAY accept
`if condition` and `while condition` as equivalent control statements.
Conditions use the normal expression syntax without an additional delimiter
such as `$`.

A `do` block executes once before its `until` condition is evaluated. If the
condition is `0`, the block executes again; a nonzero condition continues with
the following statement. `break` exits the innermost `while` or `do-until`
without evaluating the condition. Parentheses around the `until` condition are
required (MUST). A source missing the closing `}`, `until`, `(`, or `)` MUST be
rejected, and the parser MUST report the following token or the end of the
source as the error position.

```matra
do {
  set (count = count + 1)
}
until (count >= 10)
```

Expressions include literals, variables, calls, indexing, field access,
unary `-` and `!`, arithmetic, comparisons, and logical operators. A function
whose result type is not `unit` MUST return on every final control-flow path.

## WebAssembly boundary

The host owns file access and starts a generated module. Program code runs
inside Wasm and receives data through linear memory. The planned ABI lowers a
`bytes` argument to `(pointer: i32, length: i32)`. It will provide
`byte_length(source)` and `byte_at(source, index)` without granting filesystem
or network access to compiled code.

In the seed subset, `allocate_bytes(size)` returns `bytes` from a bump
allocator. `byte_set(bytes, index, value)` writes the low 8 bits of `value` at
the given offset, and `byte_pointer(bytes)` returns the value's first pointer.
These are temporary intrinsics for the self-hosted compiler's binary emitter
and ABI records.

## Struct allocation in the current subset

Constructor arguments are evaluated once, from left to right, before reserving
the result's memory. Nested calls cannot change the address used for storing
the constructor's fields. Struct locals and aliases remain valid across later
calls, including calls that return another struct.

The compilers may reclaim temporary allocations when a function returns if
its call graph does not allocate bytes or arrays, expose their pointers, or
mutate memory. A scalar return releases that invocation's temporary region.
A new struct return retains only its fields; returning a struct that existed
before the call preserves its pointer. Allocation-producing or mutating call
graphs are excluded from this optimization, so their escaped allocations remain
valid. This is per-call reclamation, not a general garbage collector: allocations
within a long-running call can still exhaust the memory supplied by the host.

## Compiler ABI draft

A compiler module exports `memory`, `alloc(size: i32) -> i32`, and
`compile(source_pointer: i32, source_length: i32) -> i32`. Source is UTF-8.
`compile` returns the pointer to a 36-byte result record in linear memory.

The bootstrap compiler implements this ABI. A successful compilation returns
status `0` and a valid Wasm module. A failure returns status `1` and UTF-8
diagnostic text containing an error category and source offset.
For parse errors, the source offset points to the start of the token that failed
validation, or to the end of the source when an expected token is missing.

| Offset | Field | Meaning |
| --- | --- | --- |
| 0 | `status: i32` | `0` for success; nonzero for a diagnostic |
| 4 | `output_pointer: i32` | Generated Wasm bytes on success |
| 8 | `output_length: i32` | Byte length of generated Wasm |
| 12 | `diagnostic_pointer: i32` | UTF-8 diagnostic bytes on failure |
| 16 | `diagnostic_length: i32` | Byte length of the diagnostic |
| 20 | `diagnostic_code: i32` | Error category; `0` on success |
| 24 | `diagnostic_offset: i32` | Error byte offset in the UTF-8 source |
| 28 | `diagnostic_source_length: i32` | Byte length of the error range |
| 32 | `diagnostic_expected: i32` | Expected grammar kind for a parse error |

The bootstrap compiler uses diagnostic code `1` for parse errors, `2` for
unknown functions, and `3` for argument count mismatches. A host can classify
an error from this code without parsing the diagnostic text.
The compiler reports positions as UTF-8 byte offsets. The host computes display
line and column values from the source it retains.
The error range is the half-open interval
`[diagnostic_offset, diagnostic_offset + diagnostic_source_length)`. If an
expected token is missing at EOF, the compiler returns a zero-length range at
the end of the source.

`diagnostic_expected` is `0` for diagnostics other than parse errors. The
bootstrap compiler uses these kinds:

| Code | Expected grammar |
| --- | --- |
| 0 | None |
| 1 | `module` |
| 2 | Identifier |
| 3 | `fn` |
| 4 | `(` |
| 5 | Parameter or `)` |
| 6 | `:` |
| 7 | `i32` |
| 8 | `-` |
| 9 | `>` |
| 10 | `{` |
| 11 | `return` |
| 12 | Value |
| 13 | Integer |
| 14 | `)` |
| 15 | `}` |

A host can map `diagnostic_code` and `diagnostic_expected` to labels and combine
them with line and column values computed from the source. For example, a parse
error with expected kind `12` can be displayed as:

```text
parse error: expected value at 2:29
fn answer() -> i32 { return value }
                            ^^^^^
```

Tabs expand to 4-column tab stops. Columns and underline widths count Unicode
code points, and a zero-length range displays one caret. The diagnostic text
returned by the compiler remains a fallback for hosts that do not interpret the
structured fields.

The host allocates and writes source bytes, calls `compile`, then reads the
record and its referenced bytes. Memory remains valid until the next `compile`
call. The ABI gives compiled code no implicit filesystem or network capability.

## Evolution

This is a draft, not a frozen language. For a breaking syntax change, first
write a transitional compiler in the old syntax that understands the new
grammar. It can then compile the new self-hosted compiler. Preserving prior
compiler Wasm binaries keeps such migrations reproducible.
