# Matra Website

[English](./README.md) | [日本語](./README.ja.md)

Matraの公式サイトです。現在はGitHub Pagesでpreviewし、最終的に
`https://matralang.org` をcanonical domainとして運用します。

## Development

```sh
cd ../..
pnpm install
pnpm --filter @matra/website run build
pnpm --filter @matra/website run serve
```

Websiteと`@matra/*`は同じnpm workspaceで管理しています。`file:`指定や
`pnpm link`を使わなくても、packageの変更はローカルのWebsiteに反映されます。

## Information architecture

| Primary URL | Purpose | Future subdomain |
| --- | --- | --- |
| `/` | 公式トップ・入口 | `matralang.org` |
| `/docs/` | ドキュメント入口 | `docs.matralang.org` |
| `/spec/` | 言語仕様 | `docs.matralang.org/spec/` |
| `/play/` | Playground | `play.matralang.org` |
| `/examples/` | 作例 | — |
| `/packages/` | パッケージ一覧 | `api.matralang.org` |
| `/blog/` | 開発記録 | `blog.matralang.org` |

ページは`src/pages`配下のMarkdownファイルで管理します。各ファイルはPlaygroundと同様に、`*.matra` fenced code blockへページのMatra sourceを記述します。スタイルは`src/styles`に置きます。
ビルドは各Markdown文書からMatra code blockを抽出してparseし、HTMLへrenderします。
GitHub Pagesのproject pathはworkflowから`SITE_BASE_PATH`として自動設定されます。

## 運用メモ

Website側の文書は、language specificationやpackage READMEへ導線を張る入口として扱います。仕様の規範的な内容は`spec`、package APIの詳細は各`packages/*`に置き、Websiteは閲覧体験とPlaygroundへの導線を担います。
