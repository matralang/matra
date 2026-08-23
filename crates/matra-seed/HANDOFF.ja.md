# Matra seed compiler 引き継ぎ

## 現在の状態

作業ツリーはcleanです。直近の完了commitは`4750383 bootstrap emitterでsigned LEB128を一般化する`です。

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
- bootstrap lexerはASCII whitespaceと`//` commentをskipし、EOF、identifier、integer、symbolを読む
- bootstrap parserは`module`、`import`、`fn` / `export fn`、1個の`i32` parameterを読む
- bootstrap emitterはliteral return、parameter return、signed LEB128をemitする
- bootstrap compilerは2個の引数なしfunctionで、entryからhelperをcallする最小形をemitする
- call先の名前はfunction tableでWasm function indexへ解決する

## 検証

次のcommandは直近commitで成功しています。

```text
pnpm run test:seed
pnpm run lint:markdown
```

`tests/wasm.test.mjs`は、空Wasm output、result record、同一instanceの複数call、
`bytes`のfunction call、`[i32]`のread/writeに加え、bootstrap compilerが生成したWasmの
literal return、parameter return、negative return、helper callを実行検証します。

## 主要なファイル

- `src/lib.rs`: parser、型lowering、Wasm binary emitter
- `examples/compiler.md`: 自己ホストcompilerの最初のProgram source
- `tests/wasm.test.mjs`: Node.jsによるWasm実行test
- `../../spec/program.ja.md` と `../../spec/program.md`: Program draft

## 次の作業: function一覧の一般化

現在のbootstrap emitterは、single functionと「helper + entry」の2関数形を直接生成する。
任意数のfunction、parameter付きcall、function indexを扱うため、function definitionをflattenedな
`[i32]` tableへ格納する。

```matra
struct token {
  kind: i32
  start: i32
  length: i32
}

let value = token(1, 4, 2)
return value.kind
```

recordは`name_start`、`name_length`、`parameter_count`、`return_kind`、`return_value`などの
固定fieldを持つ。array of structが未実装のため、recordごとに固定strideで配置する。

推奨する実装順は次のとおり。

1. function tableのrecord layoutとstrideを定義する。
2. parserがfunctionを反復してtableへ追加する。
3. emitterがtable長からtype / function / code sectionを生成する。
4. call target名をtableで解決し、function indexをemitする。
5. parameter付きcallと複数signatureへ拡張する。

function tableの最初のlayoutは`[count, name_start_0, name_length_0, ...]`である。parserは任意数の
functionをtableへ追加でき、name-to-index解決にも使える。2関数emitterは解決したindexをcall命令へ
出力するが、現在対応する形ではhelperが先頭にあるためindexは`0`に限られる。

single functionはliteral return、または1個の`i32` parameterをreturnする形をemitする。
2関数はhelperがinteger literalをreturnし、entryが引数なしでhelperをcallする形だけをsuccessとして
emitする。未対応の複数function形・未解決callはfunctionを落としたWasmを生成せずdiagnostic statusを返す。
integer literalは正数・負数ともsigned LEB128へlowerする。

`fn`と`export fn`はどちらもparseできる。現時点でemitする単関数はexport keywordの有無にかかわらず
exportされる。

現時点で2個のfunctionがあるProgramは、helperがnonnegative integer literalをreturnし、entryが
引数なしでhelperをcallする形だけをsuccessとしてemitする。call targetがhelperと一致しない場合を
含め、それ以外はfunctionを落としたWasmを生成せずdiagnostic statusを返す。

## 注意点

- 現在の`bytes`と`[i32]`は内部で同じpointer/length mapを共有する。structはpointer-onlyの
  local mapを使用する。
- `compile_markdown`はimport closureのfunction名重複を検出する。struct名重複も同様に検出する。
- generated Wasm sectionはidの昇順でemitする。data sectionはcode sectionの後（id 11）に置く。
- 実装成功ごとにcommitするという利用者の要望がある。
