# @matra/html

[English](./README.md) | [日本語](./README.ja.md)

ドメイン非依存なMatra ASTにHTMLのセマンティクスを与えるパッケージです。

```ts
import { parse } from "@matra/core"
import { toHTML } from "@matra/html"

toHTML(parse('p(class="lead", "Hello")'))
```

静的サイトのbase pathを指定する場合は`basePath`を渡します。site-rootの`href`と`src`だけをprefixし、absolute URLとprotocol-relative URLは変更しません。

```ts
toHTML(parse('a(href="/docs/", "Docs")'), { basePath: "/website" })
// <a href="/website/docs/">Docs</a>
```
