# Archived Matra Core v0.8 Documentation

[English](./README.md) | [日本語](./README.ja.md)

> [!WARNING]
> これは、以前のHTML指向Core実装に関する非規範的なhistorical documentationです。現在の仕様は[Matra Specification v0.2](../../README.ja.md)を参照してください。ここにある例とtestは歴史的snapshotとして保存されており、現在のCore buildの一部ではありません。

@matra/core v0.8 documentationへようこそ。このarchiveは、function syntax、block syntax、template directive、HTML renderingを中心にしていた時期の設計と使い方をまとめたものです。

## Table of Contents

1. **[Introduction](./01-introduction.ja.md)**
   - Matraとは何か
   - design philosophy
   - use caseと他template engineとの比較

2. **[Syntax Overview](./02-syntax-overview.ja.md)**
   - basic structure
   - elementとattribute
   - text contentとinterpolation
   - commentとwhitespace handling

3. **[Directives](./03-directives.ja.md)**
   - conditional rendering（`m-if`, `m-else`）
   - array iteration（`m-each`）
   - tag-based / attribute-based directive style
   - best practices

4. **[API Reference](./04-api-reference.ja.md)**
   - core functions: `parse()`, `compile()`, `transform()`, `with_()`, `toHTML()`, `toJSON()`
   - typeとinterface
   - error handling
   - advanced usage

5. **[Integration Guide](./05-integration.ja.md)**
   - build tool integration（Vite, Webpack, Rollup）
   - framework integration（Express, Fastify, Koa）
   - static site generator
   - TypeScript setup

6. **[Examples](./06-examples.ja.md)**
   - blog post card
   - navigation menu
   - user profile
   - product grid
   - form with validation
   - data table
   - comment thread
   - dashboard widget

## Quick Links

- [Core README](../../../packages/core/README.ja.md)
- [CHANGELOG](../../../packages/core/CHANGELOG.ja.md)
- [GitHub Repository](https://github.com/matralang/matra/tree/main/packages/core)
- [npm Package](https://www.npmjs.com/package/@matra/core)

## Quick Start

Install:

```bash
npm install @matra/core
```

Basic usage:

```javascript
import { compile } from '@matra/core';

const template = `
  div {
    h1 { "Hello, ${name}!" }
  }
`;

const render = compile(template);
console.log(render({ name: 'World' }));
// <div><h1>Hello, World!</h1></div>
```

## Documentation Status

このarchiveの文書は一式保存されています。現在のCoreとは責務分割やAST表現が異なるため、新しい実装では現行仕様とpackage READMEを優先してください。

## Contributing

現在のcontribution guidelineは[Core README](../../../packages/core/README.ja.md)を参照してください。

## License

MIT © butchi

---

まずは[Introduction](./01-introduction.ja.md)から読むと、当時の設計意図をつかみやすくなります。
