# Matra

[English](./README.md) | [日本語](./README.ja.md)

Matraはpnpm workspaceのmonorepoとして管理されています。公開パッケージは
`@matra/*` scopeで提供します。

## 仕様

- [Matra Specification（ソース文法v0.3）](spec/README.md)
- [Matra Specification（日本語）](spec/README.ja.md)
- [v0.3の完成範囲案とrelease条件](spec/release-v0.3.ja.md)

## Webページの検証サンプル

[1つのMarkdown文書](packages/html/examples/web-page.md)に説明・Matraの構造・
JavaScriptのデータと関数をまとめ、HTML文書と同梱CSSを生成します。
Node.js 22/24、pnpm、repository指定のRust toolchainを用意して実行します。

```sh
pnpm install --frozen-lockfile
pnpm example:web-page
pnpm test:web-page
```

`packages/html/examples/dist/index.html`をブラウザで開いてください。生成後はオフラインで
閲覧できます。実装済みの`.js.part`を使う作例で、標準JavaScript module・npm・Python連携は
この経路に含みません。

## 移植性の方針

Matraの中心目標は、共通APIと対応パッケージで作った同じプロジェクトを、
Windows・macOS・Linuxでソースや設定を書き換えずに依存解決・起動・ビルド・実行できることです。
任意の外部CLIとの互換性より、依存関係を含む移植性を優先します。
Android・iOSは当面Web動作または一部サポートを想定します。

これは今後の正式サポートに向けた目標であり、現時点の動作保証ではありません。
現在の資産、保証範囲、未決のAPI設計、段階的な検証計画は
[移植性方針と共通ランタイムのロードマップ](spec/portable-runtime.ja.md)を参照してください。

v0.3の小さな実動版はNode.jsホストを使います。同じサンプルをMatra製compilerでWasmへbuildし、
共通API経由で入力fileの読み込み・Matraでの処理・結果の書き出しを実行します。
Node.js 22/24、pnpm、Rust toolchainを用意し、repository rootで実行してください。

```text
pnpm portable -- build crates/matra-seed/examples/portable main.matra main.wasm
pnpm portable -- run crates/matra-seed/examples/portable main.wasm
```

パッケージ管理、npm・Python連携、独立したruntimeの配布はこの実動版に含めません。
3 OS検証のCI定義はありますが、正式サポートの宣言ではありません。

## パッケージ

- [`@matra/core`](packages/core)
- [`@matra/command`](packages/command)
- [`@matra/graphics`](packages/graphics)
- [`@matra/html`](packages/html)
- [`@matra/math`](packages/math)
- [`@matra/math-compute-engine`](packages/math-compute-engine)

各パッケージは、Coreが定義するツリー表現とparser / renderer境界を共有しながら、
HTML、Math、Graphics、実行環境統合などのdomain-specificな責務を分担します。

## XML-style markup

文書ノードは XML-style markup としても記述できます。属性は文字列、本文は text と子要素として
解釈し、空白を保持します。既存の `tag(attrs) { ... }` も引き続き使用できます。
`<>` は Matra node の境界を明示する補助記法で、`.class` shorthand も使用できます。

```matra
<article>
  <p.lead>Hello <strong>Matra</strong>!</p>
  <img src="image.png" />
</article>
```

XML 全体や HTML の省略・補正規則には対応しません。範囲と制約は
[文法仕様](spec/grammar.ja.md#xml-style-markup)を参照してください。

## Compiler bootstrap

Rust seed compilerとMatra製bootstrap compilerの開発状況は
[`crates/matra-seed`](crates/matra-seed/README.ja.md)を参照してください。

## Website

公式サイト・ドキュメント・Playgroundは
[`matralang/website`](https://github.com/matralang/website) で管理しています。

## Development

```sh
pnpm install
pnpm run build
pnpm test
pnpm run lint
```

英語文書は`name.md`、対応する日本語文書は`name.ja.md`とします。
JavaScript / TypeScriptなどのformatにはBiomeを使用します。`pnpm run format`でformatできます。
