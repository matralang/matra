# Matra

[English](./README.md) | [日本語](./README.ja.md)

Matra is maintained as a pnpm workspace monorepo. Published packages keep the
`@matra/*` scope.

## Specification

- [Matra Specification (source grammar v0.3)](spec/README.md)
- [Matra Specification（日本語）](spec/README.ja.md)
- [Proposed v0.3 scope and release criteria](spec/release-v0.3.md)

## Web page validation example

Keep prose, Matra structure, and JavaScript data/functions in
[one Markdown document](packages/html/examples/web-page.md), then generate a complete
HTML page with bundled CSS. With Node.js 22/24, pnpm and the repository's Rust toolchain:

```sh
pnpm install --frozen-lockfile
pnpm example:web-page
pnpm test:web-page
```

Open `packages/html/examples/dist/index.html` in a browser. The generated page works
offline. This example uses the implemented `.js.part` subset; standard JavaScript
modules, npm and Python integration remain outside this route.

## Portability policy

Matra's central goal is to resolve dependencies, start, build, and run the same project
using common APIs and supported packages on Windows, macOS, and Linux without changing
source or configuration. Portability, including dependencies, takes priority over
compatibility with arbitrary external CLIs.
Android and iOS initially target Web operation or partial support.

This is a goal for future formal support, not a guarantee of current behavior.
See the [portability policy and common runtime roadmap](spec/portable-runtime.md)
for existing assets, guarantee boundaries, open API decisions, and phased validation.

The small working v0.3 subset uses a Node.js host. Build the same sample to Wasm with
the Matra-written compiler, then read an input file, process it in Matra, and write
the result through common APIs. Prepare Node.js 22/24, pnpm, and the Rust toolchain,
then run from the repository root:

```text
pnpm portable -- build crates/matra-seed/examples/portable main.matra main.wasm
pnpm portable -- run crates/matra-seed/examples/portable main.wasm
```

This subset excludes package management, npm/Python integration, and standalone runtime distribution.
Three-OS CI is configured; this is not a declaration of formal support.

## Literate documents

`@matra/core/experimental/literate` provides an experimental Node.js 22/24 API
for building and running literate documents. It runs trusted document code
without an OS sandbox or timeout guarantee. Its compiler Wasm is bundled, so
Rust is not needed after installation. Standard JavaScript modules, npm, and
Python integration are not implemented. See the
[Core API and limitations](packages/core/README.md#experimental-nodejs-literate-api)
and [literate module contract](spec/literate-modules.md).

## Packages

- [`@matra/core`](packages/core)
- [`@matra/command`](packages/command)
- [`@matra/graphics`](packages/graphics)
- [`@matra/html`](packages/html)
- [`@matra/math`](packages/math)
- [`@matra/math-compute-engine`](packages/math-compute-engine)

## XML-style markup

Document nodes can also use XML-style markup. Attributes are strings; content consists of text
and child elements with whitespace preserved. Existing `tag(attrs) { ... }` remains supported.
The `<>` delimiters make Matra node boundaries explicit and also support `.class` shorthand.

```matra
<article>
  <p.lead>Hello <strong>Matra</strong>!</p>
  <img src="image.png" />
</article>
```

Full XML and HTML omission/tree-repair rules are not supported. See the
[grammar specification](spec/grammar.md#xml-style-markup) for the supported subset.

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
pnpm run lint
```

Biome formats JavaScript, TypeScript, JSON, and CSS files. Run `pnpm run format` to format them.
