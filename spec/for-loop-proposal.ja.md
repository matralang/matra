# Matra Program: for構文の設計案

[English](./for-loop-proposal.md) | [日本語](./for-loop-proposal.ja.md)

これは未実装・非規範の設計案です。対象はMatra Programとcompiler sourceです。
現行仕様は[Matra Program](./program.ja.md)で、`fn name(parameters) -> type`を維持します。

## 推奨構文

```matra
let (total = 0)
for (let (i = 0); i < 3; set (i = i + 1)) {
  set (total = total + i)
}
```

```ebnf
for          = "for", "(", initializer, ";", expression, ";", update, ")", block ;
initializer  = "let", "(", binding, ")" | update ;
update       = "set", "(", identifier, "=", expression, ")" ;
```

通常の括弧付き`let` / `set`とexpressionを再利用します。既存localから開始する場合は
initializerに`set (i = 0)`を使えます。初期段階では3要素をすべて必須とし、header内の
旧形式`let i = 0`や`i = i + 1`は追加しません。通常の旧statement記法の受理は継続します。
token間にはwhitespaceとline commentを許し、`;`はこのheader内の区切りです。

## 実行意味とdata model

initializerを1回実行し、conditionがnonzeroの間、body、update、conditionの順に実行します。
初回conditionが0でもinitializerは実行します。`break`は最内周のloopを終了し、updateを
実行しません。`return`やtrapでもupdateは実行しません。`continue`は別の設計段階です。

bindingとlocal indexは既存のfunction-local規則を再利用し、新しいblock scopeは導入しません。
上の例では終了後に`total == 3`、`i == 3`になります。updateは既存localへの`set`に限定し、
値を返すassignment expressionや新しいmutation演算子は導入しません。

parserでは`For(initializer, condition, update, body)`として保持し、実行系ではinitializerと
既存の`while`へlowerする案を推奨します。updateはwhile bodyの末尾へ置くため、既存の
break frameを再利用できます。self-host compilerではparse・length・writerのすべてが
同じheader境界を使う必要があります。

## 互換性と導入順序

`for`の予約語化は、その名前をidentifierに使うsourceへのv0.x破壊的変更です。
実装前にexamples・tests・READMEで影響箇所を列挙し、migration方針を正本の両言語版へ記載します。
既存の`fn`、`let`、`set`、`while`、`do-until`の記法は変更しません。

導入は仕様更新、Rust seed、self-hostの順です。`i++` / `++i`は値を返すか、評価順序、
代入可能な対象の定義が必要なので、独立した変更として後から設計します。

## 必要な検証

- initializerの1回実行、0回・1回・複数回のbody実行、updateの回数と順序。
- `break` / `return`でupdateを飛ばし、while・do-untilとの入れ子で最内周を終了すること。
- headerのlocalと後続localのindex、typed let、既存localを使うinitializer。
- コメントを含むheader、call引数の丸括弧、算術・比較条件。
- 欠落した`;`・`)`・body、空の各要素、update内の`let`、`i++`の拒否。
- 欠落位置の次tokenまたはEOFを指すdiagnostic。
- focused実行test、Stage 2/3 byte equality、seed全test、lint、diff check。
