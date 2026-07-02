# @matra/site

Matra の公式サイトです。`@matra/core` でpage sourceをparseし、`@matra/html`で
静的HTMLを生成します。Matra Specification v0.2の入口もこのappにまとめます。

## 開発

リポジトリのルートで依存関係をインストールし、次のコマンドを実行します。

```sh
npm run site:build
npm run site:serve
```

GitHub Pages向けのサブパス付き出力は、リポジトリのルートで次のように確認できます。

```sh
SITE_BASE_PATH=/matra npm run site:build
```

`main`ブランチへのサイト関連の変更、または手動実行でGitHub Pagesへデプロイされます。
初回のみ、GitHubのリポジトリ設定でPagesのSourceを「GitHub Actions」にしてください。

ページは `src/pages`、共通レイアウトは `src/layouts`、スタイルは `src/styles` に置きます。
page moduleはMatra source stringをdefault exportします。

## 拡張方針

- 公式サイト: `src/pages/index.ts`
- 仕様書: `/docs/` 以下
- Playground: `/playground/`（Core parserとHTML rendererをbrowser bundleでも使用）
