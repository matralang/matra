# Matra seed compiler

統一 Matra と互換 Matra Program を WebAssembly へ compile する Rust 製 seed compiler と、Matra で記述した bootstrap compiler の
開発資産です。bootstrap基盤は成立していますが、本番compilerとしての利用は推奨しません。

## 現在地

- Rust seedから再現可能なstage-1 compiler Wasmを生成できる
- stage-1は限定されたMatra Program、struct return、nested `if`、loop内算術条件と`break`をcompileできる
- diagnosticは36-byte result ABIでsource rangeと期待grammarを返す
- compiler artifactはcontent-addressed cacheとSHA-256 sidecarを持つ
- stage-1からstage-2、stage-3までcompiler自身をcompileできる
- stage-2とstage-3の生成Wasmはbyte単位で一致する

self-host検証はstage-1、stage-2、stage-3の順にcompiler sourceをcompileし、stage-2とstage-3の
byte一致を判定する。成功時は各StageのSHA-256と処理時間を表示する。

```text
pnpm bootstrap:verify
```

## 統一文法

Rust seed は [統一文法](../../spec/unified-grammar.ja.md) の文書 profile と native compiler profile を扱う。
文書 profile は string/number/boolean/null、array/object、member/call、node、`fn`、`return`、
`if` / `else`、`for`、代入、`while`、`do-until`、`break` を Wasm で実行する。
制御構文は式で、if は分岐の値、for は反復結果の配列、while/do-until は null を返す。
node body は式ごとに一つの child を追加し、`...expression` で配列を明示展開する。
`let (x = value)`、`if (condition)`、`for (item in items)` の丸括弧は規則に従って省略できる。

```text
cargo run --manifest-path crates/matra-seed/Cargo.toml -- \
  crates/matra-seed/examples/document.matra /tmp/document.wasm
```

生成した文書 Wasm は付属 host で実行する。

```js
import { readFile } from "node:fs/promises"
import { instantiateUnified } from "./crates/matra-seed/host/unified-host.mjs"

const program = await instantiateUnified(await readFile("/tmp/document.wasm"))
console.log(program.run())
```

Rust library は `compile_unified(source)`、`unified::parse(source)`、
`unified::evaluate_static(&module)` を提供する。static 取得は動的な式を実行せず
`EvaluationRequired` error を返す。Markdown では `--entry document.matra` で名前付き fence を選べる。

`examples/compiler.md` は `compiler.matra` fence に移行済みで、`module compiler` が native profile を選ぶ。
Rust seed の共通 parser で構文木を作り、既存の型・linear-memory ABI へ lower する。
自己ホスト compiler も文書 profile を解析し、暫定 host ABI の Wasm を生成する。
`bootstrap:verify` は各 Stage で共通の受理・拒否・実行テストも実施する。
既存 `.matra.program` fence は互換入口として保持する。影響範囲は compiler example、fence を読む host/test、
seed README、統一文法の日英仕様であり、旧 Program example の一括書き換えは不要。

## Command

Rust seedでMarkdown Programをcompileする。

```text
cargo run --manifest-path crates/matra-seed/Cargo.toml -- \
  INPUT.md OUTPUT.wasm --entry NAME.matra.program
```

cached stage-1 compilerでMatra sourceをcompileする。

```text
pnpm bootstrap:compile -- INPUT.matra OUTPUT.wasm
```

release向けcompiler Wasmとchecksumをmaterializeする。

```text
pnpm bootstrap:artifact -- dist/matra-bootstrap.wasm
```

関連testとrepository全体のcheckを実行する。

```text
pnpm run test:seed
pnpm run lint
```

## 構成

- [`src/`](src/): Rust seed compiler
- [`examples/compiler.md`](examples/compiler.md): Matra製bootstrap compiler source
- [`host/`](host/): Node.js host、cache、artifact、self-host検証command
- [`tests/`](tests/): Rust seedとbootstrap compilerのintegration test
- [`HANDOFF.ja.md`](HANDOFF.ja.md): bootstrap成立までの調査履歴（archive）
- [`../../spec/program.ja.md`](../../spec/program.ja.md): Program ABI draft

生成Wasmとcacheは`target/`または指定した出力先へ置かれ、repositoryにはcommitしない。release workflowは
`v*` tagまたは手動実行でWasmとchecksumをActions artifactへuploadする。

## 成熟度

このcompilerは`experimental`相当である。限定文法の検証、artifact再現性、host ABIの評価には利用できるが、
一般入力を処理する本番compilerには未対応である。self-host成立後もfuzzing、resource limit、ABI versioning、
cross-platform再現性、release provenanceの整備が必要になる。
