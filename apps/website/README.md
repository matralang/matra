# Matra Website

[English](./README.md) | [日本語](./README.ja.md)

Matraの公式サイトです。現在はGitHub Pagesでpreviewし、最終的に
`https://matralang.org` をcanonical domainとして運用します。

## Development

```sh
cd ../..
pnpm install
pnpm --filter @matra/website run dev
```

`dev` builds the site, serves `dist` at `http://localhost:3000`, and rebuilds when a file under `src/` changes.

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

Pages are Markdown files under `src/pages`. Native `*.matra` pages start with front matter (`title`, `description`, and `layout`) and contain only the content inside `main`; the shared layout provides the HTML document. Styles live in `src/styles`.
Place reusable source in a named Markdown fence and reference it from a Matra element with `src="matra:filename"`; the build injects that fence's text content.
The build extracts that Matra code block, parses it, and renders it to HTML.
Use a `page.program.matra` fence for repeated content. It shares front matter and layout with static pages, and explicitly executes the existing unified grammar (`fn`, `for`, member access, and child spread) through `evaluateUnified()`. A `page.matra` fence continues to use only `evaluateStatic()`, without execution fallback.
Pages requiring TypeScript integration may use a trusted `*.matra.ts` fenced code block. It executes as JavaScript during the build, so use it only for repository-managed source.
Write a `.matra.ts` block as a valid TypeScript module: `export default matra\`...\``.
GitHub Pagesのproject pathはworkflowから`SITE_BASE_PATH`として自動設定されます。

## Program migration and follow-up proposals

Docs, Packages, and the Specification index now construct nodes directly in Matra Program instead of generating source strings with `JSON.stringify()` and `matra.raw()`. Grammar and ABI are unchanged.

- General Programs have no module import contract. Relative imports and exports, with cycle handling and source diagnostics, would allow shared cards, layouts, and navigation.
- There is no standard `String()` or `padStart()` API. Card numbers are explicit strings in the data; conversion and padding functions would enable automatic numbering without new syntax.
- String escapes and multiline strings are rejected. Named fences still supply code text; an escape or raw-string specification would make embedded quotes and newlines easier to express.
- DOM, Worker, filesystem, and esbuild integration remains in TypeScript. Migrating it requires contracts for asynchronous execution, event callbacks, and host capabilities, beyond grammar changes.

These are proposals only. Any grammar extension should update both authoritative specifications first and add shared parser and execution coverage.
