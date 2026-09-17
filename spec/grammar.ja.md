# Matra Grammar v0.2（廃止）

[English](./grammar.md) | [日本語](./grammar.ja.md) | [索引](./README.ja.md)

この文書は Core v0.2 の歴史的な文法です。一般の `.matra` の正本は
[統一文法 v0.3 draft](./unified-grammar.ja.md) へ移りました。以下の規則を新規 source や
parser 実装に適用してはなりません。

## ソーステキスト

ソーステキストはUnicodeです。空白、tab、CR、LFをwhitespaceとします。textの
delimiter内を除き、token間のwhitespaceは意味を持ちません。文書はroot
expressionをちょうど1つ含まなければなりません（MUST）。

## 関数構文

関数構文は標準記法です。

```matra
section(id="intro", heading("Title"), paragraph("Body"))
```

`(`の前のidentifierがtagです。位置引数はソース順にchildとなり、
`name=value`引数はpropertyになります。propertyは位置引数より前に置かなければならず
（MUST）、すべてのchildはすべてのpropertyの後に続きます。

identifierはASCII letterまたは`_`で始まり、以降はASCII letter、digit、`_`、
`-`を使用できます。`true`、`false`、`null`は予約語です。

literalは二重引用符string、number、boolean、`null`です。numberには符号、小数部、
指数表記を使用できます。v0.2はstring escape sequenceを定義しません。valueの
位置にある裸のidentifierはstringを表します。

互換性のため、引数の`{key: value}`からpropertyを指定できます（MAY）。keyword
propertyが標準であり、新しい文書はobject形式を使用すべきではありません
（SHOULD NOT）。

## 文書構文

文書構文は簡潔な代替記法です。

```matra
article.card#main[lang="en"] {
  h1 { "Title" }
  p`Body`
}
```

`.name`はclassを追加し、`#name`はIDを設定します。`[name=value]`はpropertyを
追加し、`value`にはstring、number、boolean、`null`、array、objectを使用できます。
属性はコンマで区切らなければならず、空白だけの区切りは許可されません。これは属性
リストの閉じ括弧とarray valueを曖昧なく判別するためです。

```matra
chart[options=[{theme: "dark"}], series=[[1, 2, 3]]]
```

複数のclassは1つの空白で連結します。複数のID selectorまたは同じpropertyの指定が
ある場合、ソース上で最後の指定が採用されます。波括弧bodyはchild nodeまたは引用符
stringを含みます。

backtick textとtilde textは、それぞれ1つのstring childを生成します。

```matra
p`hello`
p~hello~
```

v0.2ではdelimiterをescapeできません。複数のchildに仮想rootを与えるため、
`$root { ... }`を使用できます（MAY）。`<!-- text -->`はcomment textを唯一の
childに持つ`#comment` nodeを生成します。

## 参照文法

次のEBNFは説明的なものです。適合するparserの字句上の除外とerror処理は、上記の
動作を実現しなければなりません（MUST）。

```ebnf
document       = expression ;
expression     = function-node | document-node | root-node | comment ;
function-node  = identifier, "(", [ property-list, [ ",", child-list ] | child-list ], ")" ;
property-list  = property-or-object, { ",", property-or-object } ;
property-or-object = property | object-props ;
child-list     = child, { ",", child } ;
child          = function-node | array | literal | identifier ;
property       = identifier, "=", (value | function-node) ;
object-props   = "{", [ pair, { ",", pair } ], "}" ;
pair           = (identifier | string), ":", value ;
value          = array | object | string | number | boolean | null | identifier ;
array          = "[", [ value, { ",", value } ], "]" ;
object         = "{", [ pair, { ",", pair } ], "}" ;
document-node  = tag, { class | id }, [ attributes ], [ body | short-text ] ;
attributes     = "[", [ attribute, { ",", attribute } ], "]" ;
attribute      = identifier, "=", value ;
body           = "{", { expression }, "}" | "{", string, "}" ;
short-text     = "`", text, "`" | "~", text, "~" ;
root-node      = "$root", [ body ] ;
comment        = "<!--", text, "-->" ;
class          = ".", tag ;
id             = "#", tag ;
literal        = string | number | boolean | null ;
```

## 等価な形式

次の形式はdata model上で等価なnodeを生成しなければなりません（MUST）。

```matra
p(class="lead", "hello")
p.lead { "hello" }
```
