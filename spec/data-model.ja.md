# Matra Data Model v0.2

[English](./data-model.md) | [日本語](./data-model.ja.md) | [索引](./README.ja.md)

## Node

Matra文書はroot nodeをちょうど1つ表現します。nodeは次の順序付きtupleです。

1. `tag`: nodeを識別するstring
2. `props`: string keyからvalueへのmap
3. `children`: nodeまたはvalueの順序付きlist

tagとproperty keyはstringでなければなりません（MUST）。ドメイン固有の意味は
この仕様では定義しません。

## モーフィオンとの対応

この節で定める文書Morphionは、Matra ASTを数学モデルとして一貫して扱うためにv0.3で導入する概念です。
ASTを単に別形式へ変換するだけでなく、nodeの各構成要素を指数で一意に位置づけ、
指数から係数への有限写像として捉えます。項列はこの有限写像を表記したものです。
これは文書nodeの構造と値を数学的な対応関係で記述するものであり、通常の多項式として
計算することを意味しません。

文書nodeを、指数と係数`val`を持つ有限個の項として表します。
指数は非負の安全な整数、またはstringです。数値`0`と文字列`"0"`は異なる指数です。

| 指数 | 係数`val`が表すもの |
| --- | --- |
| 数値`0` | `tag`のstring |
| 正整数`n` | `children[n - 1]` |
| string `key` | `props[key]` |

```json
[
  { "exponent": 0, "val": "p" },
  { "exponent": 1, "val": "Hello" },
  { "exponent": 2, "val": 0 },
  { "exponent": "class", "val": "lead" }
]
```

この項列は`p` node、`class="lead"`、children `["Hello", 0]`に対応します。
node内で指数はtag・child位置・property keyを特定し、`val`はそこでの値を保持します。
したがって、対応するMorphionからASTへ戻すときもchildの順序、property key、値を失いません。
数値指数と文字列指数を別領域とすることで、child位置と同じ文字列のproperty keyも衝突しません。
`@matra/core`は`MatraMorphion`型、`astToMorphion(ast)`と`morphionToAST(terms)`を提供します。
これはnode単位の表現であり、係数内の子nodeは既存の文書ASTとして保持します。
子nodeにも同じ対応を適用できます。配列・map内のvalueを別のnodeとして再解釈しません。
parserの`MatraModule`は変換対象ではなく、評価後の文書ASTを変換します。
この仕様の制約を満たすASTとMorphionは、source positionを除いて互いに一意に復元できます。

指数`0`の項をちょうど1つ持ち、その係数はstringでなければなりません（MUST）。
childの整数指数は`1`から欠番なく続き、同じ指数は重複してはなりません（MUST NOT）。
欠番、重複、負数、小数、非有限数、安全な整数範囲外の指数を拒否します。
逆変換は項の入力順に依存しません。`astToMorphion()`は`0`、childの整数昇順、
property keyのUTF-16 code unit昇順で項を出力します。

この対応での項は文書の位置・keyを持つため、係数`0`、`false`、`null`、空文字列を
消去してはなりません（MUST NOT）。同類項の加算、零項の除去、項の積は定義しません。
指数は文書の構造上の住所であって、数式の基底に対する冪ではありません。
この文書モデルと、Compute Engine adapterの数式展開用`MorphionForm`は別の表現です。
係数は文書data modelに従い、関数・非有限数・循環などは拒否します。
相互変換は値をcopyし、nodeのsource positionを除外します。
既存の文法、MatraJSON形式、評価規則、compiler ABIは変更しません。

## Value

valueは次のいずれかです。

- string
- 有限のnumber
- boolean
- null
- valueの順序付きlist
- string keyからvalueへのmap

valueはJSON互換でなければなりません（MUST）。`undefined`、function、symbol、
big integer、非有限数、循環構造はMatra valueではありません。

property valueにnodeを置いてもかまいません（MAY）。そのnodeは未評価式を
表します。domainはrendering前にproperty式を評価し、rendererは未評価の
まま到達した式を拒否できます（MAY）。

```matra
circle(cx=Cos(theta))
```

```json
{
  "tag": "circle",
  "props": {
    "cx": { "tag": "Cos", "props": {}, "children": ["theta"] }
  },
  "children": []
}
```

## MatraJSON

MatraJSONはdata modelの標準交換表現です。nodeを3要素のJSON配列で表します。

```text
[tag, props, children]
```

例:

```json
["group", { "role": "list" }, [
  ["item", {}, ["one"]],
  ["item", {}, ["two"]]
]]
```

第1要素はstring、第2要素はmap、第3要素はlistでなければなりません（MUST）。
childの順序とscalarの型を保持しなければなりません（MUST）。

`children`の直下でこの形に一致する3要素配列はnodeとして解釈します。array value
の内部は再帰的にnodeとして解釈してはなりません。したがって、node形式と同じvalue
配列は、少なくとも1段のarrayまたはmapで包むことで保持できます。

```json
["div", {"attr": [["chart", {}, []]]}, []]
```

上の`attr`の値はarrayであり、その内部の3要素配列はnodeではありません。producerは
このような包みを使わずにMatraJSON nodeと区別できないvalue配列を直接置くことを避ける
べきです（SHOULD）。

`props`内の式nodeも同じ3要素のMatraJSON形式を使います。object形式の
ASTでは、object形式のnodeとして保持します。

## 等価性

標準文法の XML-style markup も同じ node を構築します。`<hr />`、`<hr></hr>`、
`hr {}` は等価です。markup 属性は string、本文は string と子 node になり、文字参照は
復号します。引用符の種類や自己終了の表記は保持しません。名前空間の名前は string として
保持し、URI 解決は行いません。`<a.button>Link</a>` の `.button` は tag 名の一部ではなく
class shorthand で、`a.button { "Link" }` と等価です。
詳細は[文法仕様](./grammar.ja.md)を参照してください。

2つのMatra文書は、tag、propertyのkeyとvalue、child value、childの順序が
再帰的に等しい場合にdata model上で等価です。propertyのserialize順序は
意味を持ちません。

## source position

object形式のAST nodeは、`start`と`end`のsource pointを持つ`position`
memberを保持できます（MAY）。各pointは0始まりの`offset`と1始まりの
`line`、`column`を持ちます。positionにsource識別子を含めてもかまいません。

source positionはparser metadataであり、data modelの等価性には含めません。
標準の3要素MatraJSON形式では意図的に除外します。

## ドメインの意味論

data modelはrendering、interpolation、directive、tagの動作を定義しません。
domainはtree構築後にそのtreeを解釈できます（MAY）。
