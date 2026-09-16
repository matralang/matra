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
1 byteを書き込みます。`byte_pointer(bytes)`はそのpointerを返します。
`allocate_i32_array(size)`、`array_get(array, index)`、`array_set(array, index, value)`は
`[i32]`のallocationとaccessを提供します。

`bool`とstableなcompiler ABIは下記の予定syntaxとして定義しますが、まだ未実装です。
seed subsetはfieldがすべて`i32`のstructを実装します。struct valueはlinear memory上のfieldを
指すpointerで、constructorは`name(value, ...)`、field readは`value.field`です。field assignment、
nested struct、struct array、`bytes` fieldは未実装です。bootstrap compilerは下記ABIの暫定subsetを実装します。

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
`byte_pointer(bytes)`は`bytes` valueの先頭pointerを返します。これらは自己ホストcompilerの
binary emitterとABI record向けの暫定intrinsicです。

## 現在のsubsetにおけるstructの領域管理

constructorの引数は左から右へ一度ずつ評価し、その後に結果の領域を確保する。引数内のnested callが
別の領域を確保しても、各fieldの格納先は変わらない。struct localとaliasは、後続のstruct-return callを
またいでも有効である。

bytes・arrayの確保、pointerの取り出し、memoryの変更を行わないcall graphでは、関数のreturn時に
一時領域を回収できる。scalar returnはその呼び出しの一時領域を全回収し、新規struct returnは返すfieldだけを
残す。呼び出し前から存在したstructを返す場合は、元のpointerを維持する。領域の確保やmemoryの変更を行う
call graphはこの最適化から除外し、外へ返した領域を保持する。

これは関数呼び出し単位の回収であり、汎用garbage collectorではない。長時間returnしない関数内での確保は、
hostが用意したmemoryを使い切る可能性がある。

## Compiler ABI draft

compiler moduleは`memory`、`alloc(size: i32) -> i32`、
`compile(source_pointer: i32, source_length: i32) -> i32`をexportします。sourceはUTF-8です。
`compile`はlinear memory上の36-byte result recordへのpointerを返します。

bootstrap compilerはこのABIを実装済みです。成功時はstatus `0`と有効なWasm moduleを返します。
失敗時はstatus `1`と、error分類およびsource offsetを含むUTF-8 diagnostic textを返します。
parse errorのsource offsetは検証に失敗したtokenの先頭を指し、期待したtokenが欠落した場合は
source末尾を指します。

| Offset | Field | 意味 |
| --- | --- | --- |
| 0 | `status: i32` | successは`0`、diagnosticはnonzero |
| 4 | `output_pointer: i32` | success時の生成Wasm bytes |
| 8 | `output_length: i32` | 生成Wasmのbyte length |
| 12 | `diagnostic_pointer: i32` | failure時のUTF-8 diagnostic bytes |
| 16 | `diagnostic_length: i32` | diagnosticのbyte length |
| 20 | `diagnostic_code: i32` | error分類。success時は`0` |
| 24 | `diagnostic_offset: i32` | UTF-8 source上のerror byte offset |
| 28 | `diagnostic_source_length: i32` | error範囲のbyte length |
| 32 | `diagnostic_expected: i32` | parse errorで期待したgrammar kind |

bootstrap compilerのdiagnostic codeは、parse errorが`1`、unknown functionが`2`、
argument count mismatchが`3`です。hostはdiagnostic textをparseせず、このcodeでerrorを分類できます。
compilerは位置をUTF-8 byte offsetで返し、hostが保持するsourceから表示用のlineとcolumnを計算します。
error範囲は`[diagnostic_offset, diagnostic_offset + diagnostic_source_length)`の半開区間です。
期待tokenがEOFで欠落した場合は、source末尾に長さ`0`の範囲を返します。

`diagnostic_expected`はparse error以外では`0`です。bootstrap compilerは次のkindを使います。

| Code | Expected grammar |
| --- | --- |
| 0 | none |
| 1 | `module` |
| 2 | identifier |
| 3 | `fn` |
| 4 | `(` |
| 5 | parameterまたは`)` |
| 6 | `:` |
| 7 | `i32` |
| 8 | `-` |
| 9 | `>` |
| 10 | `{` |
| 11 | `return` |
| 12 | value |
| 13 | integer |
| 14 | `)` |
| 15 | `}` |

hostは`diagnostic_code`と`diagnostic_expected`をlabelへ変換し、sourceから計算したline/columnと
組み合わせて表示できます。例えばexpected kind `12`のparse errorは
次のように表示します。

```text
parse error: expected value at 2:29
fn answer() -> i32 { return value }
                            ^^^^^
```

tabは4-column tab stopへ展開し、UTF-8文字はUnicode code point単位でcolumnとunderline幅を計算します。
長さ`0`のrangeはcaretを1個表示します。compilerが返すdiagnostic textは、構造化fieldを解釈できない
host向けのfallbackとして利用できます。

hostはsource bytesをallocateして書き込み、`compile`をcallした後、recordと参照先bytesを
読みます。memoryは次の`compile` callまで有効です。このABIはcompiled codeへfilesystemや
networkの暗黙のcapabilityを与えません。

## 進化

これはdraftであり、言語を固定するものではありません。破壊的なsyntax変更では、まず
旧syntaxで新grammarを理解する移行compilerを書きます。そのcompilerが新syntaxの
自己ホストcompilerをcompileします。過去compilerのWasm binaryを保持することで、
migrationを再現可能にします。
