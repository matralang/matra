# Matra CLI

[English](./README.md) | [日本語](./README.ja.md)

`@matra/cli`は`matra` commandを提供します。Matra projectの初期化、
単一ページ文書と複数ページサイトのbuild、front matterで宣言された
npm/Python依存関係のinstall、localの開発previewを行えます。

## インストール

Node.js 22または24が必要です。

```sh
npm install --global @matra/cli
```

## クイックスタート

```sh
matra init hello
cd hello
matra build
matra dev
```

`matra init`は、`index.md`（FrontMatter、Matra構造、JavaScript data）、
`@matra/styles`由来の編集可能な`matra.css`とそのlicense file、
`.gitignore`を生成します。出力先directoryは既存であってはなりません。

`matra build`はcurrent directoryの`index.md`をcompile・実行し、
`dist/index.html`、`dist/matra.css`、`dist/matra.css.LICENSE`を生成します。
生成されたHTMLはbrowserで直接開けます。閲覧にnetworkは不要です。

`matra dev`は`127.0.0.1:3000`（`--port`で変更可能）でprojectを配信し、
変更を検知して再buildします。browserをreloadすると変更を確認できます。

## SVG出力

Matraの出力に`svg` nodeを含めると、`matra build`は生成HTMLへinline SVGとして出力します。
SVGの属性は明示し、`viewBox`も指定してください。

```matra
html {
  head { title { "SVG example" } }
  body {
    svg(width=64 height=64 viewBox="0 0 64 64") {
      circle(cx=32 cy=32 r=20 fill="tomato") {}
    }
  }
}
```

## コマンド

```text
matra init DIRECTORY
matra build
matra install [DOCUMENT] [--yes]
matra deps install [DOCUMENT] [--yes]
matra deps install (npm|python) DOCUMENT [--yes]
matra deps update (npm|python) DOCUMENT [--yes]
matra site install [--yes]
matra site build
matra dev [--port PORT]
matra --version
```

外部moduleを使うには、文書のfront matterの`matra.javascript.packages`と
`matra.python.packages`にpackage名を列挙し、`matra install`
（alias: `matra deps install`）で両ecosystemを準備します。既定の文書は
`index.md`です。`matra deps install`はnetworkアクセス前に確認を求め、
npmのlifecycle scriptは無効化されます。

## 複数ページサイト

CLIは宣言的なsite生成workflowにも対応します。`matra.site.yaml`、
`matra.site.json`、または`matra.site.matra`を作成し、`pages/`配下に
contentを置いて、`matra site install`と`matra site build`を実行すると
`dist/`配下にrouteが生成されます。設定schemaと制限は
[site-generation契約](../../spec/site-generation.ja.md)を参照してください。

## セキュリティ上の注意

信頼できる文書のみをbuildしてください。build中に選択されたJavaScriptと
Pythonが実行され、OS sandboxやtimeoutはありません。

## ライセンス

MIT
