# Matra Grammar v0.2

[English](./grammar.md) | [日本語](./grammar.ja.md) | [索引](./README.ja.md)

## ソーステキスト

ソーステキストはUnicodeです。空白、tab、CR、LFをwhitespaceとします。textの
delimiter内を除き、token間のwhitespaceは意味を持ちません。文書はroot
expressionをちょうど1つ含まなければなりません（MUST）。

## 関数構文

関数構文は標準記法です。

```matra
section(heading("Title"), paragraph("Body"), id="intro")
```

`(`の前のidentifierがtagです。位置引数はソース順にchildとなり、
`name=value`引数はpropertyになります。

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

`.name`はclassを追加し、`#name`はIDを設定し、`[name="value"]`はstring propertyを
追加します。複数のclassは1つの空白で連結します。波括弧bodyはchild nodeまたは
引用符stringを含みます。

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
function-node  = identifier, "(", [ argument, { ",", argument } ], ")" ;
argument       = property | object-props | function-node | literal | identifier ;
property       = identifier, "=", value ;
object-props   = "{", [ pair, { ",", pair } ], "}" ;
pair           = (identifier | string), ":", value ;
value          = string | number | boolean | null | identifier ;
document-node  = tag, { class | id }, [ attributes ], [ body | short-text ] ;
attributes     = "[", { tag, "=", string }, "]" ;
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
p("hello", class="lead")
p.lead { "hello" }
```
