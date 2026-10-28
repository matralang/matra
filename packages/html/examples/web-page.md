---
matra:
  entry: main.matra
  values:
    - content.js.part
    - analytics/total.js.part
    - format/minutes.js.part
---

# 説明とコードを一緒に持つWebページ

この文書では、Matraでページの構造を記述し、JavaScriptでデータと集計・表示処理を記述します。
記事と読了時間は検証用の架空データです。repository rootで実行します。

```sh
pnpm install --frozen-lockfile
pnpm example:web-page
pnpm test:web-page
```

Node.js 22/24、repository指定のpnpmとRust toolchainが必要です。
出力は`packages/html/examples/dist/index.html`と`matra.css`です。
生成したHTMLはブラウザで直接開けます。生成後の閲覧にはネットワークもRustも不要です。
この作例はrepository内の検証用です。build/run関数は内部runtimeから直接importしており、
npm packageの公開APIではありません。v0.3ではNode.js向けの実験的サブパス
`@matra/core/literate`からの提供と、公開importだけで動く導入作例への移行を予定しています。
対応するcompiler Wasmを同梱し、将来の独立package化を予定しています。
公開条件と未決事項は[literateの公開API契約](../../../spec/literate-modules.ja.md#v03の公開api配布契約実装予定)を参照してください。

## ページの構造はMatraで書く

入口は`main.matra`です。各式が1つのchildになるため、ループの結果を並べる箇所には
`...for`を明記します。本文の静的な部分にはXML-style markupも使えます。

```main.matra
html(lang="ja") {
  head {
    meta(charset="utf-8") {}
    meta(name="viewport" content="width=device-width, initial-scale=1") {}
    title { content.title }
    link(rel="stylesheet" href="./matra.css") {}
  }
  body {
    header {
      <p>Matra / 小さな文書づくり</p>
      h1 { content.title }
      p { content.description }
    }
    main {
      section {
        <h2>読む・学ぶ・つくる</h2>
        ul {
          ...for (article in content.articles) {
            li {
              h3 { article.title }
              p { article.summary }
              p { "読了の目安："; format.minutes(article.minutes) }
            }
          }
        }
        p {
          "すべて読む目安："
          format.minutes(analytics.total(content.articles))
        }
      }
    }
    footer {
      <p>構造をMatraで、データと処理をJavaScriptで。</p>
    }
  }
}
```

## データと処理はJavaScriptで書く

初版の連携形式では、`.js.part`の本文は単一のJavaScript式です。
データはobject式、処理は通常のarrow functionとして公開します。
ファイル名の`/`がMatra側の名前の区切りになります。

```content.js.part
({
  title: "Matra & Web",
  description: "説明とコードから、ひとつのWebページをつくる。",
  articles: [
    { title: "モーフィオンから式を眺める", summary: "基底・指数・係数の構造を考える。", minutes: 8 },
    { title: "JavaScriptから学ぶ", summary: "使い慣れた配列と関数を文書に接続する。", minutes: 6 },
    { title: "文書を作品にする", summary: "意味のあるHTMLとCSSで仕上げる。", minutes: 10 }
  ]
})
```

```analytics/total.js.part
articles => articles.reduce((sum, article) => sum + article.minutes, 0)
```

```format/minutes.js.part
value => `${value}分`
```

## 実行の範囲

文書先頭のFrontMatterで入口と上記3つの値だけを明示的に選択します。
Matra製compilerでWasmへ変換し、実行結果を文書ASTへ変換して`@matra/html`へ渡します。
この実用経路ではMorphion変換を行いません。文書Morphionは、ASTの構造を数学モデルとして
一貫して扱うための概念と対応規則であり、通常のHTML生成に不要な変換を加えないためです。

```js
const bundle = await buildLiterate(markdown, { document: "web-page.md" })
const value = await runLiterate(bundle)
const ast = staticValueToAST(value)
const html = toHTML(ast)
```

`buildLiterate()`はユーザーコードを実行せず、設定の検証とコンパイルを行います。
`runLiterate()`はJavaScriptの値を初期化し、Matraを実行して文書の値を返します。
この作例ではbundleをメモリ内で受け渡し、中間ファイルや子プロセスを使いません。

Morphionの定義とASTとの対応は[文書モデル](../../../spec/data-model.ja.md#モーフィオンとの対応)で説明します。
JavaScriptの値や関数は実行時に初期化されます。自分が信頼する文書を実行してください。
この作例は`.js`のimport/export、npm module、Python連携を実装したものではありません。
記事の題名に「モーフィオン」が含まれますが、この作例では文書Morphion変換も、
Compute Engineを使う数式の展開・計算も行いません。
