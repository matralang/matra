# Matra seed compiler 引き継ぎ

## 現在の状態

bootstrap compilerのsourceは`examples/compiler.md`にあります。seed compilerはMarkdownの
`*.matra.program` fenceをWasm moduleへcompileします。

- `bytes`はWasmの`(pointer, length)`へlowerされ、parameter、local、return、function callに対応
- `allocate_bytes`、`byte_set`、`byte_pointer`を実装
- `[i32]`は同じ`(pointer, length)` layoutで、`allocate_i32_array`、`array_get`、`array_set`を実装
- bootstrap compilerは`memory`、`alloc(size) -> i32`、
  `compile(source_pointer, source_length) -> i32`をexport
- 空sourceの`compile`は20-byte result recordを返し、recordは有効な空Wasm moduleを参照
- 未対応または不正なsourceはstatus `1`と空diagnostic fieldを返す
- `struct`は固定長の`i32` field、constructor、field read、parameter/local/returnに対応
- bootstrap lexerはASCII whitespaceと`//` commentをskipし、EOF、identifier、integer、symbolを読む
- bootstrap parserは`module`、`import`、`fn` / `export fn`、1個の`i32` parameterを読む
- bootstrap emitterはliteral return、parameter return、signed LEB128をemitする
- bootstrap compilerは任意数の引数なしfunctionでliteral returnと引数なしcallをemitする
- call先の名前はfunction tableでWasm function indexへ解決する

## 検証

次のcommandは直近commitで成功しています。

```text
pnpm run test:seed
pnpm run lint:markdown
```

`tests/wasm.test.mjs`は、空Wasm output、result record、同一instanceの複数call、
`bytes`のfunction call、`[i32]`のread/writeに加え、bootstrap compilerが生成したWasmの
literal return、parameter return、negative return、複数function、非ゼロindexのcallを実行検証します。

## 主要なファイル

- `src/lib.rs`: parser、型lowering、Wasm binary emitter
- `examples/compiler.md`: 自己ホストcompilerの最初のProgram source
- `tests/wasm.test.mjs`: Node.jsによるWasm実行test
- `../../spec/program.ja.md` と `../../spec/program.md`: Program draft

## 次の作業: function recordとsignatureの一般化

現在のfunction tableは`[count, name_start_0, name_length_0, ...]`という最小layoutである。
parserは任意数のfunctionをtableへ追加し、emitterはtable長からtype / function / code sectionを生成する。
call target名はtableでWasm function indexへ解決し、非ゼロindexもemitできる。

```matra
struct token {
  kind: i32
  start: i32
  length: i32
}

let value = token(1, 4, 2)
return value.kind
```

次はtableを固定strideのrecordへ拡張し、`name_start`、`name_length`、`parameter_count`、
`return_kind`、`return_value`などを保持する。array of structは未実装のためflattenedな`[i32]`を使う。

推奨する実装順は次のとおり。

1. function tableのrecord layoutとstrideを定義する。
2. parameter情報とbody kindをparserからtableへ格納する。
3. parameter数ごとにWasm typeを生成してfunction sectionから参照する。
4. parameter付きcallのargumentを検証してemitする。
5. section lengthとfunction indexをunsigned LEB128へ一般化する。

single functionはliteral return、または1個の`i32` parameterをreturnする形をemitする。複数functionは
引数なしに限り、各bodyがinteger literalまたは引数なしcallをreturnする形をemitする。最後のfunctionを
exportし、未解決callや複数function内のparameterはdiagnostic statusを返す。integer literalは正数・負数とも
signed LEB128へlowerする。複数function用sectionのlength、count、indexはまだ1-byte値に限られる。

`fn`と`export fn`はどちらもparseできる。現時点でemitする単関数はexport keywordの有無にかかわらず
exportされる。

## 注意点

- 現在の`bytes`と`[i32]`は内部で同じpointer/length mapを共有する。structはpointer-onlyの
  local mapを使用する。
- `compile_markdown`はimport closureのfunction名重複を検出する。struct名重複も同様に検出する。
- generated Wasm sectionはidの昇順でemitする。data sectionはcode sectionの後（id 11）に置く。
- 実装成功ごとにcommitするという利用者の要望がある。
