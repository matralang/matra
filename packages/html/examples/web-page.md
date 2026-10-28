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

build scriptは入口と上記3つの値だけを明示的に選択します。
Matra製compilerでWasmへ変換し、実行結果の文書nodeをモーフィオンの項表現へ写し、
renderer用のASTへ戻して`@matra/html`へ渡します。

```js
const terms = astToMorphion(ast)
const html = toHTML(morphionToAST(terms))
```

指数0の`val`がtag、正整数nの`val`がchildren[n - 1]、文字列keyの`val`がprops[key]です。
この作例のrootは`html`なので、先頭の項は`{ exponent: 0, val: "html" }`になります。
詳細は[文書モデルの対応](../../../spec/data-model.ja.md#モーフィオンとの対応)を参照してください。
JavaScriptの値や関数は実行時に初期化されます。自分が信頼する文書を実行してください。
この作例は`.js`のimport/export、npm module、Python連携を実装したものではありません。
記事データのモーフィオンは記事の題名です。この作例で行うのは文書モデルの変換で、
Compute Engineを使う数式の展開・計算は行っていません。
