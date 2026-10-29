# Matra Specification

[English](./README.md) | [日本語](./README.ja.md)

Matraはルート付きツリーを記述する、ドメイン非依存の記法です。パッケージの
バージョンは、この言語仕様のバージョンとは独立しています。

**MUST**、**MUST NOT**、**SHOULD**、**MAY**は規範的な要件を表します。

現行のソース文法は v0.3 です。Data Model／AST の v0.2 は文書値の表現を扱い、
旧 Parser 契約は歴史的資料です。構文と評価は文法仕様を正本とします。

## 仕様書

1. [Data Model](./data-model.ja.md) — Matraが表現する抽象的な値
2. [AST](./ast.ja.md) — object形式のメモリ内表現
3. [Grammar v0.3](./grammar.ja.md) — `.matra` の標準ソース文法、parse と評価の契約
4. [Parser v0.2（歴史的資料）](./parser.ja.md) — 旧 parse interface、出力、mode、error
5. [Matra Program](./program.ja.md) — WebAssembly向け実行profileのdraft

英語文書は`name.md`、対応する日本語文書は`name.ja.md`とします。両言語版の
規範的な意味は同一です。

過去の提案（現行仕様ではない）: [Matra Programのfor構文](./for-loop-proposal.ja.md)。

## 設計方針とロードマップ

- [Matra Language White Paper v0.3](./whitepaper-v0.3.ja.md) — 設計思想、文書Morphion、
  JavaScript連携、自己ホスト、応用経路と制限をまとめた現行の非規範的な白書。旧資料との違いも説明。
- [v0.3の完成範囲案とrelease条件](./release-v0.3.ja.md) — package優先度、
  実装段階、検証サンプルと公開前の検証条件。
- [移植性方針と共通ランタイム](./portable-runtime.ja.md) — PC 3 OSで目指す保証範囲、
  v0.3の最小host APIと実行手順、パッケージ・タスク・検証のロードマップ。正式サポートの宣言ではない。
- [Markdownによる多言語の文芸的プログラミング](./literate-modules.ja.md) — 名前付きfenceを
  仮想ファイルとして扱い、JavaScriptの公開値（関数・データ）とMatraを接続する。
  明示入口と`.js.part`の初版契約・実行手順、および後続の短縮形・module連携の設計案。

## 適用範囲

tagとproperty名に組み込みのドメイン的意味はありません。HTML rendering、
interpolation、directive、評価処理はdomain packageに属し、v0.2の範囲外です。

## 過去の文書

旧 [Core v0.2 文法](./archive/core-v0.2/grammar.ja.md)は歴史的資料であり、
現行 source や parser 実装には適用しません。

非規範的なHTML指向のCore v0.8 guideは
[`archive/core-v0.8`](./archive/core-v0.8/README.md)に保存しています。
