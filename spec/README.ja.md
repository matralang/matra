# Matra Specification v0.1

[English](./README.md) | [日本語](./README.ja.md)

Matraはルート付きツリーを記述する、ドメイン非依存の記法です。パッケージの
バージョンは、この言語仕様のバージョンとは独立しています。

**MUST**、**MUST NOT**、**SHOULD**、**MAY**は規範的な要件を表します。

## 仕様書

1. [Data Model](./data-model.ja.md) — Matraが表現する抽象的な値
2. [AST](./ast.ja.md) — object形式のメモリ内表現
3. [Grammar](./grammar.ja.md) — ソーステキストと構文
4. [Parser](./parser.ja.md) — parse interface、出力、mode、error

英語文書は`name.md`、対応する日本語文書は`name.ja.md`とします。両言語版の
規範的な意味は同一です。

## 適用範囲

tagとproperty名に組み込みのドメイン的意味はありません。HTML rendering、
interpolation、directive、評価処理はdomain packageに属し、v0.1の範囲外です。

## 過去の文書

非規範的なHTML指向のCore v0.8 guideは
[`archive/core-v0.8`](./archive/core-v0.8/README.md)に保存しています。
