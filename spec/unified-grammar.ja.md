# Matra 統一文法 v0.3 draft

[English](./unified-grammar.md) | [索引](./README.ja.md)

## 状態と互換性

これは一般の `.matra` の次期正本である。v0.x の破壊的変更として、旧 Core v0.2 の
関数ノード構文、selector の `#id`、backtick／tilde text、`$root`、`= expr` は受理しない。
`.matra.program` と Rust seed compiler はこの変更の対象外であり、当面は v0.1 draft の
文法を維持する。

現在の TypeScript 実装では `@matra/core` の `parse()` がこの構文木を返す。字句・構文と
静的評価の最小部分を提供する。`fn`、`if`、`for`、
代入、演算子、import/export は parser 実装前であり、受理して別の意味に読み替えない。

## 評価 mode の提案

静的取得とは別の明示 API に `if`、`for`、`fn`、`return` を追加する。選択された分岐と反復は
式結果を node body へソース順で追加し、宣言は child を追加しない。import/export、型、代入は対象外とする。

## ソースとトップレベル

source は改行または `;` で区切った statement 列である。`let` は宣言であり出力を
生成しない。他のトップレベル式は出力式であり、現段階では最後の式が静的評価の結果となる。

```matra
let title = "Matra"
article { h1 { title } }
```

## 式とノード

通常の call は `name(arguments)`、member access は `object.member` である。ノード構築は
必ず body を持ち、`tag.classes(attributes) { statements }` の形である。`=` は属性、`:` は
object entry を区切る。class は最初の出現順を保って重複を除去する。

```matra
a.link(href=page.url) { page.title }
chart(options={theme: "dark"}, series=[10, 20]) {}
```

node body は statement の式結果をソース順の child とする。`let` は child を追加しない。
配列と object は暗黙に child へ展開または文字列化しない。

## 静的取得

literal、array、object、先行する static `let`、それらだけから成る node は実行せずに
取得できる。未束縛 reference、member access、call は `EvaluationRequired` であり、静的取得が
実行へ fallback してはならない。

## 未確定事項

次は実装せず保留する: import/module 解決、文字列 escape／複数行文字列、明示的 `class`
属性との結合、重複属性、文書内 scalar と null の renderer 上の扱い、scope／可変性、型推論、
`return`、改行継続、二項演算子周辺の空白、Wasm 値表現。

推奨案は、明示的 `class` と shorthand を空白結合して安定重複除去し、属性重複は parse error、
文書の scalar/null は renderer ごとの明示的規則とすることである。
