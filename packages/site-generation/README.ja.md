# @matra/site-generation

`@matra/site-generation`はMarkdownコンテンツとMatraのページ・レイアウトから
静的サイトを生成します。`matra.site.yaml`、`matra.site.json`、
`matra.site.matra`で設定するファイル方式のAPIと、JavaScriptからページを
直接登録するAPIを提供します。

## 要件

Node.js 22以降を推奨します。projectにinstallします。

```sh
npm install @matra/site-generation
```

## ファイル方式での生成

project rootにsite設定を作成します。

```yaml
version: 1
site:
  pages: pages
  layouts: layouts
  defaultLayout: default
  output: dist
```

`pages/`以下にMarkdownページを配置します。通常の`.md`はcontentとして
公開されます。実行するMatraページとlayoutは`.matra.md`を使い、
FrontMatterの`matra.entry`でentry pointを指定します。次のようにbuildします。

```js
import { buildSite } from "@matra/site-generation"

const outputs = await buildSite(process.cwd())
console.log(`Generated ${outputs.length} files`)
```

`buildSite()`はsite設定を読み込み、ページ・layout・文書を収集してサイトを
生成し、生成fileのpathを返します。`matra.site.yaml`、`matra.site.json`、
`matra.site.matra`は同じversioned schemaを使用します。

## JavaScriptからの直接登録

ページdataがすでにJavaScriptにあり、中間fileを作らずMatraに直接渡す場合は
`generateSite()`を使います。

```js
import { generateSite } from "@matra/site-generation"

const products = [
  { slug: "first", title: "First product", description: "Product details" },
  { slug: "second", title: "Second product", description: "More details" },
]

const outputs = await generateSite({
  root: process.cwd(),
  defaultLayout: "default",
  layouts: {
    default: { source: "html { head {}; body { ...page.content } }" },
  },
  pages: products.map(product => ({
    kind: "matra",
    route: `/products/${product.slug}/`,
    source: "main { h1 { page.data.title }; p { page.data.description } }",
    data: product,
  })),
})
console.log(`Generated ${outputs.length} files`)
```

各ページは`kind`（`"matra"`または`"markdown"`）、`route`、`source`文字列を
指定します。`data`、`layout`、`document`は任意で、ページdata、使用layout
（`layout: false`で無効化可能）、diagnosticと相対link解決に使う論理文書pathを
指定します。`layouts`と`components`は名前から`{ source, document? }`へのmapです。

両APIはlayout、asset、base path、再利用可能なMatra部品に対応します。
Matra部品は`fn Name(props, children) { ... }`で定義し、単一の文書nodeを返します。
設定schema、入力規則、部品の動作、出力保証の詳細は
[サイト生成の契約](../../spec/site-generation.ja.md)を参照してください。

## 出力の安全性

入力を検証し、公開前にページを生成します。生成fileはstageを経てまとめて公開され、
生成・検証に失敗した場合は既存出力を維持します。manifestで生成fileを追跡し、
次回の成功buildで不要になった生成fileを削除しますが、追跡されていないfileは
削除しません。入力symlinkとproject root外のpathは拒否されます。

## ライセンス

MIT
