# Matra Program v0.1 draft

[English](./program.md) | [索引](./README.ja.md)

## 目的

Matra Programは、自己ホストcompilerを含むMatra toolingを実装する実行profileです。
Matra Coreはdomain-neutralなtree記法のまま維持し、このprofileが別のsyntaxと
実行意味を定義します。

Markdown文書をsource bundleとし、名前付き`*.matra.program` fenced code blockを
moduleとして扱います。seed compilerはentry blockとそのimportを1つのWebAssembly
moduleへcompileします。

## 現在のseed subset

seed compilerは現在、`i32` / `bytes` function、local variable、function call、
arithmetic、comparison、`if` / `else`、`while`、`break`を実装します。WebAssembly
linear memoryを1 page exportし、`bytes` parameterとreturn valueを`(pointer, length)`へ
lowerします。
`byte_length(source)`と`byte_at(source, index)`を利用できます。
`allocate_bytes(size)`はlinear memory上の`bytes`を確保し、`byte_set(bytes, index, value)`は
1 byteを書き込みます。

array、struct、`bool`、安定したcompiler ABIは、下記の予定syntaxとして定義しますが、
まだ未実装です。

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

identifierには`snake_case`を使用します。`fn`、`let`、`if`、`else`、`while`、
`return`、`break`、`module`、`import`、`export`はreserved wordです。

`()`はexpressionのgrouping、functionのdeclarationとcallに使用します。`[]`は
array literal、index、array typeのために予約します。`{}`はblockを区切り、将来は
struct literalも区切ります。Program blockの内部へdocument Matra syntaxは直接
埋め込みません。

## Module

すべてのProgram blockは`module name`で開始します。`import name`はfence filenameでは
なくmodule名でblockを解決します。選択したentryとtransitive importをまとめてcompile
します。function名は現時点ではimport closure内でglobalであり、一意でなければなりません。

Markdown文書に複数のProgram blockがある場合、callerはentry fenceを選択しなければ
なりません。

```text
cargo run --manifest-path crates/matra-seed/Cargo.toml -- \
  source.md output.wasm --entry compiler.matra.program
```

## Draft grammar

whitespaceはtokenを区切ります。`//`から行末までをline commentとします。statement間の
newlineを推奨します。

```ebnf
program    = module, { import }, { function } ;
module     = "module", identifier ;
import     = "import", identifier ;
function   = [ "export" ], "fn", identifier, "(", [ parameters ], ")",
             "->", type, block ;
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

expressionはliteral、variable、call、index、field access、unary `-`と`!`、
arithmetic、comparison、logical operatorを持ちます。result typeが`unit`以外の
functionは、最後のすべてのcontrol-flow pathでreturnしなければなりません。

## WebAssembly境界

hostがfile accessを担当して生成moduleを起動します。Program codeはWasm内部で実行し、
linear memoryでdataを受け取ります。予定しているABIでは`bytes` argumentを
`(pointer: i32, length: i32)`へlowerします。`byte_length(source)`と
`byte_at(source, index)`を提供し、compiled codeへfilesystemやnetworkの権限を渡しません。

seed subsetでは`allocate_bytes(size)`がbump allocatorから`bytes` valueを返します。
`byte_set(bytes, index, value)`は指定したoffsetへvalueの下位8 bitを書き込みます。
これらは自己ホストcompilerのbinary emitter向けの暫定intrinsicです。

## Compiler ABI draft

compiler moduleは`memory`、`alloc(size: i32) -> i32`、
`compile(source_pointer: i32, source_length: i32) -> i32`をexportします。sourceはUTF-8です。
`compile`はlinear memory上の20-byte result recordへのpointerを返します。

| Offset | Field | 意味 |
| --- | --- | --- |
| 0 | `status: i32` | successは`0`、diagnosticはnonzero |
| 4 | `output_pointer: i32` | success時の生成Wasm bytes |
| 8 | `output_length: i32` | 生成Wasmのbyte length |
| 12 | `diagnostic_pointer: i32` | failure時のUTF-8 diagnostic bytes |
| 16 | `diagnostic_length: i32` | diagnosticのbyte length |

hostはsource bytesをallocateして書き込み、`compile`をcallした後、recordと参照先bytesを
読みます。memoryは次の`compile` callまで有効です。このABIはcompiled codeへfilesystemや
networkの暗黙のcapabilityを与えません。

## 進化

これはdraftであり、言語を固定するものではありません。破壊的なsyntax変更では、まず
旧syntaxで新grammarを理解する移行compilerを書きます。そのcompilerが新syntaxの
自己ホストcompilerをcompileします。過去compilerのWasm binaryを保持することで、
migrationを再現可能にします。
