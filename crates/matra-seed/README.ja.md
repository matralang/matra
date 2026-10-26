# Matra seed compiler

Matra source を WebAssembly へ compile する Rust 製 seed compiler と、Matra で記述した bootstrap compiler の
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

## 標準文法

Rust seed は [標準文法](../../spec/grammar.ja.md) の文書 profile と native compiler profile を扱う。
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
import { instantiateMatra } from "./crates/matra-seed/host/value-host.mjs"

const program = await instantiateMatra(await readFile("/tmp/document.wasm"))
console.log(program.run())
```

Rust library は `compile(source)`、`program::parse(source)`、
`program::evaluate_static(&module)` を提供する。static 取得は動的な式を実行せず
`EvaluationRequired` error を返す。Markdown では `--entry document.matra` で名前付き fence を選べる。

`examples/compiler.md` は `compiler.matra` fence に移行済みで、`module compiler` が native profile を選ぶ。
Rust seed の共通 parser で構文木を作り、既存の型・linear-memory ABI へ lower する。
自己ホスト compiler も文書 profile を解析し、暫定 host ABI の Wasm を生成する。
`bootstrap:verify` は各 Stage で共通の受理・拒否・実行テストも実施する。
各Stageのcompilerで生成したportableサンプルのWasmについても、
共通host API経由のfile読み書き・引数・標準出力を検証する。
compiler module は標準文法と `*.matra` fence に統一する。`module` 宣言が native profile を選び、
それ以外の `.matra` source は document profile として扱う。旧 `.matra.program` fence は受理しない。

## Command

### Portable runtime v0.3

Node.js 22/24ホスト上で、同じMatra／Wasmサンプルを変更せずに実行する最小実装を提供する。
repository rootで次を実行する。

```text
pnpm portable -- build crates/matra-seed/examples/portable main.matra main.wasm
pnpm portable -- run crates/matra-seed/examples/portable main.wasm
pnpm test:portable
```

`build`はMatra製Stage 1 compilerを使い、`run`は共通APIでfileを読み書きする。
契約、制限、3 OS CIの完了条件は
[移植性方針](../../spec/portable-runtime.ja.md#v03の小さな実動版)を参照する。
パッケージ管理や独立runtimeの配布は含まない。

### Compiler commands

Rust seedでMarkdown Programをcompileする。

```text
cargo run --manifest-path crates/matra-seed/Cargo.toml -- \
  INPUT.md OUTPUT.wasm --entry NAME.matra
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

テストfixtureは現行の`*.matra` fence、`let`と直接代入、明示的な文・field区切りを使う。
廃止した記法を再び受理するようcompilerを変更してはならない。
`test:seed`はtest fileを直列実行する。各fileがCargoや自己ホストcompilerを起動するため、
並列実行によるbuild lock・CPU・memoryの競合で外部プロセスの期限を消費しないようにする。
テスト用の外部プロセスは原則120秒、個別指定があればその期限で停止し、
起動失敗・timeout・signal終了を実行command付きの失敗として報告する。
自己ホストのintegration testはcacheを使わずStage 2/3を生成するため、
通常の単一testより時間がかかる。最後の成功行だけでは全testの完了を意味しない。

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
