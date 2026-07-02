# Matra

Matra is maintained as an npm workspaces monorepo. Published packages keep the
`@matra/*` scope.

## Specification

- [Matra Specification v0.2](spec/README.md)
- [Matra Specification v0.2（日本語）](spec/README.ja.md)

## Packages

- [`@matra/core`](packages/core)
- [`@matra/graphics`](packages/graphics)
- [`@matra/html`](packages/html)
- [`@matra/math`](packages/math)
- [`@matra/math-compute-engine`](packages/math-compute-engine)

## Apps

- [`@matra/site`](apps/site) — 公式サイト・ドキュメント・Playground

## Development

```sh
npm install
npm run build
npm test
```

サイトだけをビルドする場合は `npm run site:build` を実行します。
