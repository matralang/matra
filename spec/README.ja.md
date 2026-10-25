# Matra Specification

[English](./README.md) | [日本語](./README.ja.md)

Matraはルート付きツリーを記述する、ドメイン非依存の記法です。パッケージの
バージョンは、この言語仕様のバージョンとは独立しています。

**MUST**、**MUST NOT**、**SHOULD**、**MAY**は規範的な要件を表します。

現行のソース文法は v0.3 です。Data Model／AST の v0.2 は文書値の表現を扱い、
旧 Parser 契約は歴史的資料です。構文と評価は統一文法を正本とします。

## 仕様書

1. [Data Model](./data-model.ja.md) — Matraが表現する抽象的な値
2. [AST](./ast.ja.md) — object形式のメモリ内表現
3. [Unified Grammar v0.3](./unified-grammar.ja.md) — 統一 `.matra` のソーステキストと構文
4. [Parser](./parser.ja.md) — parse interface、出力、mode、error
5. [Matra Program](./program.ja.md) — WebAssembly向け実行profileのdraft

英語文書は`name.md`、対応する日本語文書は`name.ja.md`とします。両言語版の
規範的な意味は同一です。

過去の提案（現行仕様ではない）: [Matra Programのfor構文](./for-loop-proposal.ja.md)。

## 設計方針とロードマップ

- [移植性方針と共通ランタイム](./portable-runtime.ja.md) — PC 3 OSで目指す保証範囲、
  v0.3の最小host APIと実行手順、パッケージ・タスク・検証のロードマップ。正式サポートの宣言ではない。
- [Markdownによる多言語の文芸的プログラミング](./literate-modules.ja.md) — 名前付きfenceを
  仮想ファイルとして扱い、JavaScriptの公開関数とMatraを接続する設計案。短縮形と未決事項を含む。未実装。

## 適用範囲

tagとproperty名に組み込みのドメイン的意味はありません。HTML rendering、
interpolation、directive、評価処理はdomain packageに属し、v0.2の範囲外です。

## 過去の文書

非規範的なHTML指向のCore v0.8 guideは
[`archive/core-v0.8`](./archive/core-v0.8/README.md)に保存しています。
