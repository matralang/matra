# AGENTS.md

## コマンド

- インストール: `pnpm install`
- ビルド: `pnpm run build`
- チェック: `pnpm run check`
- Lint: `pnpm run lint`
- テスト: `pnpm run test`
- 型チェック: `pnpm run typecheck`

## 開発ルール

- v0.x 系のリリースは、v1.x 系のリリースに向けての開発段階であり、破壊的変更が発生しても許容される。
- v0.x 系のリリースでは、言語の文法として JavaScript や Python のような親しみやすさを優先し、型安全性や静的解析の厳密さは二の次とする。v1.x 系のリリースでは、型安全性や静的解析の厳密さを優先する。
- 開発環境・ツールは、プロジェクトの既存構成と保守性を優先して選定する。
- コメントとコミットメッセージは、用語は英語で構わないが、特別な理由がない限り日本語で記述する。
- コードは可読性と保守性を優先し、不要な依存関係・抽象化・複雑化を避ける。
- 性能上のボトルネックが計測または明確に確認できる場合は、 WebAssembly を選択肢として検討する。
- 変更後は関連するテストと lint を実行する。

## ドキュメント

- Markdown 文書を追加・更新する場合は、プロジェクトの Markdownlint 設定に準拠する。

## Matra Programの文法変更

文法変更では、実装を先に変更せず、まず仕様・互換性・検証範囲を明確にする。

### 変更前に確認すること

- 変更対象がMatra Programの文法、Matra compiler sourceの文法、または両方のどれかを明示する。
- 仕様の正本を確認する。一般のMatra Programは`spec/grammar.ja.md`と`spec/grammar.md`、
  compiler sourceは`crates/matra-seed/examples/compiler.md`とそのbootstrap検証を対象とする。
- 変更する構文の現在のparse結果、data model、実行結果、diagnosticを確認する。
- v0.xの破壊的変更か、既存sourceを受理し続ける互換変更かを明示する。破壊的変更では、
  影響を受けるexamples・tests・README・migration文書を列挙する。

### 実装の進め方

1. 仕様書の日本語版と英語版を同じ変更単位で更新する。EBNFだけでなく、受理例、拒否例、
   whitespace・comment・delimiter・error位置などの動作契約も更新する。
2. parser、AST/data model、lowering/runtime、diagnosticのどこに影響するかを確認し、
   変更が不要な層まで改変しない。
3. 受理する最小例、拒否する最小例、既存構文との境界例、必要なら実行結果をテストに追加する。
   parserの成功だけで完了とせず、生成物または実行結果まで検証する。
4. Matra compiler source自身が新文法を使用する場合は、Rust seed、Stage 1、Stage 2、Stage 3の
   各段階でcompileできることを確認する。Stage 2とStage 3の生成Wasmはbyte単位で一致しなければならない。
5. 失敗時はparserだけのworkaround、fallback、固定offset、generated outputの直接編集で隠さない。
   最初に失敗した層と最小再現を記録し、必要なら`crates/matra-seed/HANDOFF.ja.md`へ履歴として追記する。

### 文法変更の完了条件

- [ ] 仕様の正本（日本語・英語）と互換性方針を更新した
- [ ] parser、data model、実行系、diagnosticの影響を確認した
- [ ] 受理例・拒否例・境界例の回帰testを追加した
- [ ] `pnpm run test`または変更範囲に対応する関連testが成功した
- [ ] `pnpm run lint`と`git diff --check`が成功した
- [ ] bootstrapに影響する場合、`pnpm bootstrap:verify`でStage 2/3のbyte equalityを確認した
- [ ] 生成Wasm、cache、`target/`の成果物をcommitしていない

### 依頼時の指示テンプレート

文法変更を依頼するときは、可能な範囲で次を指定する。

```text
対象: [Matra Program / compiler source / 両方]
変更する構文: [例: function call、property、配列、comment]
現在の動作: [受理・拒否・実行結果・diagnostic]
期待する動作: [新しい構文と意味、受理/拒否、実行結果]
互換性: [既存sourceを維持 / v0.xの破壊的変更 / 未定]
仕様の更新: [grammar、parser、data model、README、migrationなど]
検証: [対象test、bootstrap、byte equality、追加してほしい境界例]
制約: [変更してはいけないABI、公開API、生成物、依存関係など]
```
