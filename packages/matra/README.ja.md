# matra

[English](./README.md) | [日本語](./README.ja.md)

`matra`は[`@matra/cli`](../cli)の別名packageです。installすると`@matra/cli`が
導入され、同じ`matra` commandを利用できます。短いpackage名から始められます。

## 位置づけ

現在このpackageは`@matra/cli`へ委譲するだけの薄い別名です。今後のminor releaseで
Matra言語のメインエントリへ育てる計画で、`parse`・`evaluate`・`toHTML`・
`matra`ファクトリなど厳選した最小のprogrammatic APIを、named exportと
default exportのobjectとして`@matra/core`や`@matra/html`から再エクスポートする
予定です。より深いAPIは従来どおり個別の`@matra/*` packageから利用します。
拡張は非破壊的な追加として行い、`matra` commandは現在と同じように動作し続けます。

## インストール

Node.js 22または24が必要です。

```sh
npm install --global matra
```

これは次と同等です。

```sh
npm install --global @matra/cli
```

## アンインストール

installしたときと同じpackage名でuninstallします。

```sh
npm uninstall --global matra
```

`@matra/cli`を直接installした場合は`npm uninstall --global @matra/cli`を
実行してください。異なる名前をuninstallしてもpackageは削除されず、errorにも
なりません。installされているpackage名は`npm ls --global --depth=0`で
確認できます。

## クイックスタート

```sh
matra init hello
cd hello
matra build
matra dev
```

commandの詳細は[`@matra/cli`](../cli)を参照してください。このpackage自体は
logicを持たず、`@matra/cli`へ委譲するだけです。

## ライセンス

MIT
