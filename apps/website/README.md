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

The website and `@matra/*` packages share this pnpm workspace. Changes to a
package are available to the website locally without `file:` dependencies or
`pnpm link`.

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

Pages are Markdown files under `src/pages`. Like the Playground, each document contains its page source in a `*.matra` fenced code block; styles live in `src/styles`.
The build extracts that Matra code block, parses it, and renders it to HTML.
GitHub Pagesのproject pathはworkflowから`SITE_BASE_PATH`として自動設定されます。
