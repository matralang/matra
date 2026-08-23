# Matra seed compiler 引き継ぎ

## 現在の状態

bootstrap compilerのsourceは`examples/compiler.md`にあります。seed compilerはMarkdownの
`*.matra.program` fenceをWasm moduleへcompileします。

- `bytes`はWasmの`(pointer, length)`へlowerされ、parameter、local、return、function callに対応
- `allocate_bytes`、`byte_set`、`byte_pointer`を実装
- `[i32]`は同じ`(pointer, length)` layoutで、`allocate_i32_array`、`array_get`、`array_set`を実装
- bootstrap compilerは`memory`、`alloc(size) -> i32`、
  `compile(source_pointer, source_length) -> i32`をexport
- 空sourceの`compile`は36-byte result recordを返し、recordは有効な空Wasm moduleを参照
- 未対応または不正なsourceはstatus `1`、diagnostic code、分類・source offsetを含むUTF-8 textを返す
- `struct`は固定長の`i32` field、constructor、field read、parameter/local/returnに対応
- bootstrap lexerはASCII whitespaceと`//` commentをskipし、EOF、identifier、integer、symbolを読む
- bootstrap parserは`module`、`import`、`fn` / `export fn`、1個の`i32` parameterを読む
- bootstrap emitterはliteral return、parameter return、signed LEB128をemitする
- bootstrap compilerは任意数のfunctionでliteral/parameter returnと0または1引数のcallをemitする
- call先の名前はfunction tableでWasm function indexへ解決する
- function tableは固定stride recordでparameter数、body情報、call argument情報を保持する
- Wasm section length、count、type/function index、body/name lengthはunsigned LEB128でemitする

## 検証

次のcommandは直近commitで成功しています。

```text
pnpm run test:seed
pnpm run lint:markdown
```

`tests/wasm.test.mjs`は、空Wasm output、result record、同一instanceの複数call、
`bytes`のfunction call、`[i32]`のread/writeに加え、bootstrap compilerが生成したWasmの
literal return、parameter return、negative return、複数function、非ゼロindexのcall、
parameter付きcall、signature不一致の拒否、130文字のexport名、130 functionとindex `128`のcall、
parser/unknown call/signature errorのdiagnostic code、text、構造化source rangeを実行検証します。hostは
expected kindをlabelへ変換し、UTF-8 byte offsetから1-based line/columnを計算して表示します。function内の
parse errorは失敗したtokenの先頭を指し、期待tokenが欠落した場合はsource末尾を指します。

## 主要なファイル

- `src/lib.rs`: parser、型lowering、Wasm binary emitter
- `examples/compiler.md`: 自己ホストcompilerの最初のProgram source
- `tests/compiler-host.mjs`: result ABIを読むhost diagnostic formatter
- `tests/wasm.test.mjs`: Node.jsによるWasm実行test
- `../../spec/program.ja.md` と `../../spec/program.md`: Program draft

## 次の作業: source excerptとrange highlight

function tableは先頭にcountを置き、各functionを7-field固定strideで格納する。

```text
[count, name_start, name_length, parameter_count, body_kind, body_value,
 argument_kind, argument_value, ...]
```

`body_kind`はliteralが`0`、parameter returnが`1`、callが`2`である。`body_value`はliteral値、
parameter index、または解決済みWasm function indexを表す。parserは任意数のfunctionをtableへ追加し、
emitterはsourceを再解析せずtableからtype / function / code sectionを生成する。負のliteral `-1`と`-2`も
body kindと混同しない。`argument_kind`は引数なしが`0`、literalが`1`、caller parameterが`2`で、
`argument_value`はliteral値またはlocal indexを表す。

```matra
struct token {
  kind: i32
  start: i32
  length: i32
}

let value = token(1, 4, 2)
return value.kind
```

array of structは未実装のため、tableにはflattenedな`[i32]`を使う。

Wasmのsection length、function count、type/function index、body size、name lengthはunsigned LEB128で
emitする。function tableは事前にfunction数を数え、`count * 7 + 1`要素だけ確保する。

失敗時はASCII互換のUTF-8 bytesを確保し、result recordの`diagnostic_pointer`と
`diagnostic_length`から参照する。現在のmessageは`parse error at <offset>`、
`unknown function at <offset>`、`argument count mismatch at <offset>`である。unknown callはcallee名、
signature不一致はargument tokenのoffsetを返す。36-byte result recordの`diagnostic_code`はsuccessが`0`、
parse errorが`1`、unknown functionが`2`、argument count mismatchが`3`である。
`diagnostic_offset`と`diagnostic_source_length`はUTF-8 source上のbyte rangeであり、hostが表示用の
line/columnへ変換する。通常は失敗token全体を指し、EOFで期待tokenが欠落した場合は長さ`0`を返す。
`diagnostic_expected`はparse errorで期待したgrammar kindを`1`から`15`で表し、それ以外は`0`である。
`tests/compiler-host.mjs`はcodeとexpected kindをlabelへ変換し、line/columnを含む表示文字列を生成する。

`function_definition`はparse error offsetを保持し、`parse_function`の各失敗で検証対象tokenの位置を
記録する。function内のparse errorはfunction keywordではなく実際に失敗したtokenを指し、期待tokenが
欠落した場合はEOF offsetを返す。

1. `diagnostic_offset`が指すsource lineをexcerptとして取り出す。
2. `diagnostic_source_length`に対応するcaretまたはunderlineを生成する。
3. tabとmulti-byte文字を含むlineで表示columnとhighlight幅を検証する。

functionは0または1個の`i32` parameterを持ち、各bodyがinteger literal、parameter、またはfunction callを
returnする形をemitする。call argumentはinteger literalまたはcaller parameterに対応し、callee signatureと
引数数が一致しなければdiagnostic statusを返す。最後のfunctionをexportする。integer literalは正数・負数とも
signed LEB128へlowerする。大規模sourceをcompileする場合、host側は必要に応じてexportされたmemoryを
`memory.grow()`してからsourceとtableの領域を確保する。

`fn`と`export fn`はどちらもparseできる。現時点でemitする単関数はexport keywordの有無にかかわらず
exportされる。

## 注意点

- 現在の`bytes`と`[i32]`は内部で同じpointer/length mapを共有する。structはpointer-onlyの
  local mapを使用する。
- `compile_markdown`はimport closureのfunction名重複を検出する。struct名重複も同様に検出する。
- generated Wasm sectionはidの昇順でemitする。data sectionはcode sectionの後（id 11）に置く。
- 実装成功ごとにcommitするという利用者の要望がある。
