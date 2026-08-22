# Matra seed compiler 引き継ぎ

## 現在の状態

作業ツリーはcleanです。直近の完了commitは`82d1779 seed compilerにi32配列を追加`です。

bootstrap compilerのsourceは`examples/compiler.md`にあります。seed compilerはMarkdownの
`*.matra.program` fenceをWasm moduleへcompileします。

- `bytes`はWasmの`(pointer, length)`へlowerされ、parameter、local、return、function callに対応
- `allocate_bytes`、`byte_set`、`byte_pointer`を実装
- `[i32]`は同じ`(pointer, length)` layoutで、`allocate_i32_array`、`array_get`、`array_set`を実装
- bootstrap compilerは`memory`、`alloc(size) -> i32`、
  `compile(source_pointer, source_length) -> i32`をexport
- 空sourceの`compile`は20-byte result recordを返し、recordは有効な空Wasm moduleを参照
- 非空sourceは暫定的にstatus `1`と空diagnostic fieldを返す

## 検証

次のcommandは直近commitで成功しています。

```text
pnpm run test:seed
pnpm run lint:markdown
```

`tests/wasm.test.mjs`は、空Wasm output、result record、同一instanceの複数call、
`bytes`のfunction call、`[i32]`のread/writeを実行検証します。

## 主要なファイル

- `src/lib.rs`: parser、型lowering、Wasm binary emitter
- `examples/compiler.md`: 自己ホストcompilerの最初のProgram source
- `tests/wasm.test.mjs`: Node.jsによるWasm実行test
- `../../spec/program.ja.md` と `../../spec/program.md`: Program draft

## 次の作業: structの最小subset

lexer用に、固定長の`i32` fieldだけを持つstructを実装する。次のsyntaxを採用する。

```matra
struct token {
  kind: i32
  start: i32
  length: i32
}

let value = token(1, 4, 2)
return value.kind
```

このsubsetでは、field assignment、nested struct、array of struct、`bytes` fieldは実装しない。
Wasm memory上のlayoutはfieldを宣言順に4 bytesずつ配置する。

推奨する実装順は次のとおり。

1. `Program`へstruct declaration、`StructDefinition`と`StructField`を追加し、function前の
   `struct` declarationをparseする。
2. `ValueType`へstruct名を表すvariantを追加する。struct valueは`pointer`のみなのでWasmの
   parameter、local、returnは1 slotとする。
3. `Expression`へfield accessを追加する。`primary`の後に`.` identifierを反復してparseする。
4. constructor callのnameがstruct名なら、`allocate_bytes(field_count * 4)`と`i32.store`列へlower
   する。struct valueのpointerをresultとする。
5. field accessはpointerに`field_index * 4`を加え、`i32.load`へlowerする。
6. Node実行testに`token(20, 21, 22).length == 22`を追加する。
7. 日英のProgram draftを更新し、`pnpm run test:seed`と`pnpm run lint:markdown`を実行後、
   日本語commit messageでcommitする。

## 注意点

- 現在の`bytes`と`[i32]`は内部で同じpointer/length mapを共有する。structを加える際は、
  pointer-onlyのlocal mapを別にする方が型の取り違えを防げる。
- `compile_markdown`はimport closureのfunction名重複を検出する。struct名重複も同様に検出する。
- generated Wasm sectionはidの昇順でemitする。data sectionはcode sectionの後（id 11）に置く。
- 実装成功ごとにcommitするという利用者の要望がある。
