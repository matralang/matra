# Matra CLI

[English](./README.md) | [日本語](./README.ja.md)

`@matra/cli`は`matra` commandを提供します。Matra projectの初期化、
単一ページ文書と複数ページサイトのbuild、front matterで宣言された
npm/Python依存関係のinstall、localの開発previewを行えます。

## インストール

Node.js 22または24が必要です。推奨の導入経路は別名packageの
[`matra`](../matra)で、短い名前でこのCLIを導入できます。

```sh
npm install --global matra
```

このpackageを直接installしても同等です。

```sh
npm install --global @matra/cli
```

installされるcommandは常に`matra`です。uninstallにはcommand名ではなく、
installに使ったpackage名を指定します。

```sh
npm uninstall --global matra      # 別名package経由でinstallした場合
npm uninstall --global @matra/cli # 直接installした場合
```

installされていない名前をuninstallしても何も削除されず、errorにもならないため、
成功したように見誤りやすい点に注意してください。installされているpackage名は
`npm ls --global --depth=0`で確認できます。

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
