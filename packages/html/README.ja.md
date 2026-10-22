# @matra/html

[English](./README.md) | [日本語](./README.ja.md)

ドメイン非依存なMatra ASTにHTMLのセマンティクスを与えるパッケージです。

```ts
import { evaluateStatic, parse, staticValueToAST } from "@matra/core"
import { toHTML } from "@matra/html"

const source = '<p.lead>Hello <strong>Matra</strong>!</p>'
const ast = staticValueToAST(evaluateStatic(parse(source)))
toHTML(ast)
// <p class="lead">Hello <strong>Matra</strong>!</p>
```

静的な本文・リンク・空要素には markup が向いています。`parse()` は構文木を返すため、
静的取得と文書 AST への変換を経て renderer へ渡します。
markup 属性は文字列で、本文中の空白・改行も child として保持されます。
`<a.button.primary>` の `.class` は既存の Matra と同じ shorthand です。終了 tag は `</a>` とし、
class は繰り返しません。重複を除去して空白で連結し、明示した `class` 属性を上書きします。
式・数値属性・boolean 属性が必要な箇所は既存のノード構築を使い、混在できます。

```matra
let title = "Matra"
article.card {
  h1 { title }
  <p.lead>Structure first. <strong>Domain later.</strong></p>
  <hr />
}
```

外側の `{ ... }` は Matra の文を区切るため、字下げを text child にしません。
一方、`<article> ... </article>` の本文の字下げは保持します。
見た目だけでなく AST の属性型と空白も確認して書き換えてください。

静的サイトのbase pathを指定する場合は`basePath`を渡します。site-rootの`href`と`src`だけをprefixし、absolute URLとprotocol-relative URLは変更しません。

```ts
const link = staticValueToAST(evaluateStatic(parse('<a href="/docs/">Docs</a>')))
toHTML(link, { basePath: "/website" })
// <a href="/website/docs/">Docs</a>
```
