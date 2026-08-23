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
  let result = double(input)
  while result < 42 {
    result = result + 1
  }
  return result
}
```

Use `snake_case` for identifiers. `fn`, `let`, `if`, `else`, `while`,
`return`, `break`, `module`, `import`, and `export` are reserved words.

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
statement  = let | assignment | byte_set | if | while | break | return ;
let        = "let", identifier, [ ":", type ], "=", expression ;
assignment = identifier, "=", expression ;
byte_set   = "byte_set", "(", expression, ",", expression, ",", expression, ")" ;
if         = "if", expression, block, [ "else", block ] ;
while      = "while", expression, block ;
break      = "break" ;
return     = "return", expression ;
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

## Compiler ABI draft

A compiler module exports `memory`, `alloc(size: i32) -> i32`, and
`compile(source_pointer: i32, source_length: i32) -> i32`. Source is UTF-8.
`compile` returns the pointer to a 20-byte result record in linear memory.

The bootstrap compiler implements this ABI. A successful compilation returns
status `0` and a valid Wasm module. A failure returns status `1` and UTF-8
diagnostic text containing an error category and source offset.

| Offset | Field | Meaning |
| --- | --- | --- |
| 0 | `status: i32` | `0` for success; nonzero for a diagnostic |
| 4 | `output_pointer: i32` | Generated Wasm bytes on success |
| 8 | `output_length: i32` | Byte length of generated Wasm |
| 12 | `diagnostic_pointer: i32` | UTF-8 diagnostic bytes on failure |
| 16 | `diagnostic_length: i32` | Byte length of the diagnostic |

The host allocates and writes source bytes, calls `compile`, then reads the
record and its referenced bytes. Memory remains valid until the next `compile`
call. The ABI gives compiled code no implicit filesystem or network capability.

## Evolution

This is a draft, not a frozen language. For a breaking syntax change, first
write a transitional compiler in the old syntax that understands the new
grammar. It can then compile the new self-hosted compiler. Preserving prior
compiler Wasm binaries keeps such migrations reproducible.
