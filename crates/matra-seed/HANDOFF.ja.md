# Matra seed compiler 引き継ぎ

## 現在の状態

作業ツリーはcleanです。直近の完了commitは`8a22a39 seed compilerにstruct最小subsetを追加`です。

bootstrap compilerのsourceは`examples/compiler.md`にあります。seed compilerはMarkdownの
`*.matra.program` fenceをWasm moduleへcompileします。

- `bytes`はWasmの`(pointer, length)`へlowerされ、parameter、local、return、function callに対応
- `allocate_bytes`、`byte_set`、`byte_pointer`を実装
- `[i32]`は同じ`(pointer, length)` layoutで、`allocate_i32_array`、`array_get`、`array_set`を実装
- bootstrap compilerは`memory`、`alloc(size) -> i32`、
  `compile(source_pointer, source_length) -> i32`をexport
- 空sourceの`compile`は20-byte result recordを返し、recordは有効な空Wasm moduleを参照
- 非空sourceは暫定的にstatus `1`と空diagnostic fieldを返す
- `struct`は固定長の`i32` field、constructor、field read、parameter/local/returnに対応

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

## 次の作業: lexer

bootstrap compilerにtoken列を読むlexerを追加する。ASCII whitespaceと`//` commentをskipし、
EOF、identifier、integer、symbolを区別する単一tokenの読み取りを実装済みです。

```matra
struct token {
  kind: i32
  start: i32
  length: i32
}

let value = token(1, 4, 2)
return value.kind
```

tokenは`kind`、`start`、`length`を持つ。source bytesは既存の`bytes` valueのまま保持し、
token列をarrayへ保存するのはarray of structが利用可能になってからにする。

推奨する実装順は次のとおり。

1. `next_token(source, offset) -> token`でwhitespaceをskipする。
2. EOF、identifier、integer、symbolを`kind`で返し、identifierとintegerの連続長を計算する。
3. `compile`がEOF tokenを空Programとして成功させる。
4. Node実行testでwhitespace-only inputとtoken rangeを確認する。
5. sourceとoffsetで逐次読むtoken cursorを使い、`module identifier`と`import identifier`をparseする。
6. 引数なし、`i32` return、integer literalのfunction declarationをparseする。
7. 解析したfunctionをWasm type / function / export / code sectionへemitする。

## 注意点

- 現在の`bytes`と`[i32]`は内部で同じpointer/length mapを共有する。structはpointer-onlyの
  local mapを使用する。
- `compile_markdown`はimport closureのfunction名重複を検出する。struct名重複も同様に検出する。
- generated Wasm sectionはidの昇順でemitする。data sectionはcode sectionの後（id 11）に置く。
- 実装成功ごとにcommitするという利用者の要望がある。
