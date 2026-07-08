# Matra

[English](./README.md) | [日本語](./README.ja.md)

Matraはnpm workspacesのmonorepoとして管理されています。公開パッケージは
`@matra/*` scopeで提供します。

## 仕様

- [Matra Specification v0.2](spec/README.md)
- [Matra Specification v0.2（日本語）](spec/README.ja.md)

## パッケージ

- [`@matra/core`](packages/core)
- [`@matra/command`](packages/command)
- [`@matra/graphics`](packages/graphics)
- [`@matra/html`](packages/html)
- [`@matra/math`](packages/math)
- [`@matra/math-compute-engine`](packages/math-compute-engine)

各パッケージは、Coreが定義するツリー表現とparser / renderer境界を共有しながら、
HTML、Math、Graphics、実行環境統合などのdomain-specificな責務を分担します。

## Website

公式サイト・ドキュメント・Playgroundは
[`matralang/website`](https://github.com/matralang/website) で管理しています。

## Development

```sh
npm install
npm run build
npm test
```

英語文書は`name.md`、対応する日本語文書は`name.ja.md`とします。
