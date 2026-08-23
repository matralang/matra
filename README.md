# Matra

[English](./README.md) | [日本語](./README.ja.md)

Matra is maintained as a pnpm workspace monorepo. Published packages keep the
`@matra/*` scope.

## Specification

- [Matra Specification v0.2](spec/README.md)
- [Matra Specification v0.2（日本語）](spec/README.ja.md)

## Packages

- [`@matra/core`](packages/core)
- [`@matra/command`](packages/command)
- [`@matra/graphics`](packages/graphics)
- [`@matra/html`](packages/html)
- [`@matra/math`](packages/math)
- [`@matra/math-compute-engine`](packages/math-compute-engine)

## Compiler bootstrap

See [`crates/matra-seed`](crates/matra-seed/README.md) for the Rust seed compiler and the
Matra bootstrap compiler status.

## Website

公式サイト・ドキュメント・Playgroundは
[`matralang/website`](https://github.com/matralang/website) で管理しています。

## Development

```sh
pnpm install
pnpm run build
pnpm test
```
