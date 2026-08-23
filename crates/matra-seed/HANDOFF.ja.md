# Matra bootstrap引き継ぎ

## 目的

Rust seed compilerからMatra製compiler Wasmを生成し、そのcompiler自身で同じsourceを再compileする
bootstrapを成立させる。最終的なself-host判定はstage-2とstage-3のbyte一致とする。

## 現在の到達点

2026-08-23時点の状態は次のとおりである。

| Stage | 生成元 | 状態 |
| --- | --- | --- |
| stage-1 | Rust seed | 生成・実行・byte再現性を検証済み |
| stage-2 | stage-1 | compiler sourceの3行目で停止 |
| stage-3 | stage-2 | stage-2未生成のため未到達 |

`pnpm bootstrap:verify`は実際に各stageを生成し、成功時にはSHA-256を表示する。stage-2とstage-3が生成
できた場合はbyte一致も検証する。現在の結果は次のとおりで、exit codeは`1`である。

```text
Stage 1: ready (<sha256>)
Stage 2: blocked
examples/compiler.md:3:1: parse error: expected fn
struct token {
^^^^^^
```

これはstage-1 parserがtop-level `struct`を受理しないためである。`struct`だけを追加してもself-hostは
完成しない。compiler sourceは複数parameter、`bytes`、struct、array、local、assignment、arithmetic、
comparison、`if`、`while`、`break`、組み込みmemory操作を使用しており、parserとemitterの両方に順次
実装する必要がある。

## 検証済みの資産

- Rust seedはMarkdownの`*.matra.program` fenceとimport closureをWasmへcompileする
- bootstrap compilerは任意数の単純function、0または1個の`i32` parameter、literal、parameter return、
  0または1引数のcallをcompileする
- signed / unsigned LEB128と可変長のWasm section、index、export名をemitする
- 36-byte result ABIはstatus、output、diagnostic text、code、UTF-8 source range、expected kindを返す
- Node.js hostはUTF-8 offsetを1-based line / columnへ変換し、source underlineを表示する
- compiler artifactはsource、Rust実装、manifest、lockfile、`rustc -Vv`からcache keyを計算する
- Rust `1.97.1`を[`../../rust-toolchain.toml`](../../rust-toolchain.toml)で固定している
- 独立cacheで生成したstage-1 artifactがbyte単位で一致する
- `v*` tagとmanual dispatchでWasmとchecksumをActions artifactへuploadする

36-byte result recordのlayoutは[`../../spec/program.ja.md`](../../spec/program.ja.md)を正とする。実装の
詳細と利用commandは[`README.ja.md`](README.ja.md)を参照する。

## 再開手順

1. worktreeと直近検証を確認する。

   ```text
   git status --short --branch
   pnpm run test:seed
   pnpm run lint
   ```

2. self-host baselineを実行する。現在はstage-2 blockedによるexit code `1`が期待値である。

   ```text
   pnpm bootstrap:verify
   ```

3. [`examples/compiler.md`](examples/compiler.md)のsource順に、最初のunsupported constructを縦に実装する。
   Rust seed側ではなく、stage-1 compilerのparser、intermediate table、Wasm emitterを一組として更新する。

4. 変更ごとに`tests/wasm.test.mjs`へ小さいProgramの実行testを追加し、`bootstrap:verify`の停止位置が
   前進したことを確認する。

5. 関連testとlintが成功した単位で独立commitする。

## 次の実装単位

top-level `struct` declarationをstage-1 parserへ追加し、field情報を保持できるtable表現を決める。安価な
完了条件は、`bootstrap:verify`の最初のdiagnosticが3行目の`struct`より後へ進むことである。ただし実装は
parser受理だけで終わらせず、struct constructorとfield readを含む最小ProgramをWasmへcompile・実行する
testまでを一単位とする。

その後はcompiler sourceの出現順を基準に、複数parameterと`bytes`、control flow、localとassignment、array、
memory組み込みを進める。stage-2が生成できた時点でstage-3生成とbyte一致が自動的に検証される。

## 運用上の判断

- 現在の成熟度は`experimental`であり、本番compilerとしてreleaseしない
- generated Wasmとcacheは`target/`またはrelease出力先へ置き、source管理しない
- GitHub Actions artifactは検証用であり、GitHub Releaseへの自動添付はまだ行わない
- self-host成立後もfuzzing、resource limit、ABI version、cross-platform再現性を本番化条件として扱う
