# Matra seed compiler

Matra ProgramをWebAssemblyへcompileするRust製seed compilerと、Matraで記述したbootstrap compilerの
開発資産です。現在はbootstrap基盤の検証段階であり、本番compilerとしての利用は推奨しません。

## 現在地

- Rust seedから再現可能なstage-1 compiler Wasmを生成できる
- stage-1は限定されたMatra Program、struct return、nested `if`、loop内算術条件と`break`をcompileできる
- diagnosticは36-byte result ABIでsource rangeと期待grammarを返す
- compiler artifactはcontent-addressed cacheとSHA-256 sidecarを持つ
- stage-1によるcompiler自身のcompileは未達である

self-host検証はstage-1、stage-2、stage-3の順にcompiler sourceをcompileし、stage-2とstage-3の
byte一致を判定する。現在はcompiler sourceの最初のnested `while` statementでstage-2が停止するため、
commandはexit code `1`を返す。

```text
pnpm bootstrap:verify
```

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
- [`HANDOFF.ja.md`](HANDOFF.ja.md): 正確な再開地点と次工程
- [`../../spec/program.ja.md`](../../spec/program.ja.md): Program ABI draft

生成Wasmとcacheは`target/`または指定した出力先へ置かれ、repositoryにはcommitしない。release workflowは
`v*` tagまたは手動実行でWasmとchecksumをActions artifactへuploadする。

## 成熟度

このcompilerは`experimental`相当である。限定文法の検証、artifact再現性、host ABIの評価には利用できるが、
一般入力を処理する本番compilerには未対応である。self-host成立後もfuzzing、resource limit、ABI versioning、
cross-platform再現性、release provenanceの整備が必要になる。
