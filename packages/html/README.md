# @matra/html

[English](./README.md) | [日本語](./README.ja.md)

HTML semantics for the domain-neutral Matra AST.

```ts
import { parse } from "@matra/core"
import { toHTML } from "@matra/html"

toHTML(parse('p(class="lead", "Hello")'))
```

For a static-site base path, pass `basePath`. Site-root `href` and `src` values are prefixed, while absolute and protocol-relative URLs remain unchanged.

```ts
toHTML(parse('a(href="/docs/", "Docs")'), { basePath: "/website" })
// <a href="/website/docs/">Docs</a>
```
