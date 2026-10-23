# @matra/html

[English](./README.md) | [日本語](./README.ja.md)

HTML semantics for the domain-neutral Matra AST.

```ts
import { evaluateStatic, parse, staticValueToAST } from "@matra/core"
import { toHTML } from "@matra/html"

const source = '<p.lead>Hello <strong>Matra</strong>!</p>'
const ast = staticValueToAST(evaluateStatic(parse(source)))
toHTML(ast)
// <p class="lead">Hello <strong>Matra</strong>!</p>
```

Markup suits static text, links, and empty elements. Since `parse()` returns syntax,
retrieve its static value and convert it to a document AST before rendering.
Markup attributes are strings; whitespace and newlines in content are retained as children.
`<a.button.primary>` uses the existing Matra `.class` shorthand. Close it with `</a>`, without classes.
Classes are deduplicated and joined with spaces, overriding an explicit `class` attribute.
Use existing node construction for expressions, numeric attributes, and boolean attributes;
both forms can be mixed.
Parenthesized node attributes also accept HTML-like whitespace/newline separators; commas remain supported.
Commas are still required in function arguments, arrays, and objects.

```matra
let title = "Matra"
article.card(lang="ja" title=title) {
  h1 { title }
  <p.lead>Structure first. <strong>Domain later.</strong></p>
  <hr />
}
```

The outer `{ ... }` separates Matra statements, so indentation does not become text children.
In contrast, indentation inside `<article> ... </article>` is retained.
Check attribute types and whitespace in the AST, not just appearance, when rewriting.

For a static-site base path, pass `basePath`. Site-root `href` and `src` values are prefixed, while absolute and protocol-relative URLs remain unchanged.

```ts
const link = staticValueToAST(evaluateStatic(parse('<a href="/docs/">Docs</a>')))
toHTML(link, { basePath: "/website" })
// <a href="/website/docs/">Docs</a>
```
