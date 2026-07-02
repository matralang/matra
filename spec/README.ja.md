# Matra Specification v0.1

[English](./README.md) | [日本語](./README.ja.md)

## ステータス

この文書はMatra言語バージョン0.1を定義します。**MUST**、**MUST NOT**、
**SHOULD**、**MAY**は規範的な要件を表します。パッケージのバージョンは、
言語バージョンとは独立しています。

Matraはルート付きツリーを記述する、ドメイン非依存の記法です。HTML、Math、
Graphicsなどのドメインがtagとpropertyに与える意味は、この仕様の範囲外です。

## データモデル

Matra文書は、次のフィールドを持つ1つのnodeを表現します。

- `tag`: nodeを識別する文字列。
- `props`: JSON互換値を持つ、文字列キーのmap。
- `children`: nodeまたはJSON互換値の順序付きlist。

交換形式MatraJSONは、3要素の配列です。

```text
[tag, props, children]
```

たとえば、次のソースは、

```matra
group(item("one"), item("two"), role="list")
```

次の値を表します。

```json
["group", { "role": "list" }, [
  ["item", {}, ["one"]],
  ["item", {}, ["two"]]
]]
```

実装で使用するobject形式のASTはソース言語の一部ではありませんが、同じtag、
property、childの順序を保持しなければなりません（MUST）。

## ソーステキスト

ソーステキストはUnicodeです。空白、tab、CR、LFをwhitespaceとします。
引用符、backtick、tildeで囲まれたtextの内部を除き、token間のwhitespaceは
意味を持ちません。

文書はroot expressionをちょうど1つ含まなければなりません（MUST）。複数の
nodeに共通の仮想rootが必要な場合は、`$root { ... }`を使用できます（MAY）。

## 関数構文

関数構文はv0.1の標準記法です。

```matra
tag(child1, child2, property="value")
```

`(`の前の名前がtagになります。位置引数はソース順にchildになります。
`name=value`形式の引数はpropertyとなり、childにはなりません。

```matra
circle(x=10, y=20, r=5)
note("hello", priority=2, visible=true, owner=null)
```

使用できるliteral値はstring、number、boolean、`null`です。

- stringは二重引用符で囲みます。v0.1はescape sequenceを定義しません。
- numberには符号、小数部、指数表記を使用できます。
- 予約語`true`、`false`、`null`はidentifierとして使用できません。
- 値として使われた裸のidentifierはstringになります。
- 同じnode内でproperty名を重複させてはなりません（MUST NOT）。

入れ子の関数呼び出しはnode childになります。

```matra
section(heading("Title"), paragraph("Body"), id="intro")
```

互換性のため、任意の位置引数にあるobjectからpropertyを指定できます（MAY）。

```matra
circle({x: 10, y: 20}, "label")
```

keyword propertyが標準です。新しい文書ではobject形式の互換構文を使用すべき
ではありません（SHOULD NOT）。

## 文書構文

文書構文は簡潔な代替記法です。

```matra
article.card#main[lang="en"] {
  h1 { "Title" }
  p`Body`
}
```

tagの後には任意個の`.class` selectorと、実質的に最大1つの`#id` selectorを
記述できます。classは1つの空白で連結されて`class` propertyになり、ID
selectorは`id` propertyになります。角括弧内には0個以上の`name="value"`
propertyを記述します。

波括弧のbodyはchild nodeまたは1つの二重引用符stringを含みます。backtick
textとtilde textは、1つのstring childを表す短縮形です。

```matra
p`hello`
p~hello~
```

どちらも`p("hello")`を表します。v0.1ではdelimiterはliteralであり、escape
できません。

HTML形式のcommentは`#comment` nodeとして表現します。

```matra
<!-- explanation -->
```

## 構文モード

parserは、次の値を取るsyntax mode optionを提供できます（MAY）。

| Mode | 使用できる記法 |
| --- | --- |
| `mixed` | 関数構文と文書構文 |
| `document` | 文書構文のみ |
| `application` | 関数構文のみ |

modeを提供する場合、`mixed`をdefaultにしなければなりません（MUST）。禁止された
記法の使用はparse errorにしなければなりません（MUST）。

## ドメインの意味論

tagとproperty名に組み込みのドメイン的意味はありません。特にv0.1は、HTML
rendering、interpolation、`m-if`などのdirective、評価処理を定義しません。
domain packageはparse後にこれらの動作を定義できます（MAY）。

## エラーと適合性

適合するparserは、次の要件を満たさなければなりません（MUST）。

- 不正なソースおよび末尾に余分なテキストがあるソースを拒否する。
- childの順序とliteral値の型を保持する。
- 関数構文で重複するpropertyを拒否する。
- 上記データモデルと等価なtreeを生成する。

適合するserializerまたはrendererは、適用するドメイン固有の解釈を文書化しなければ
なりません（MUST）。この仕様が改訂されない限り、その解釈をMatra v0.1言語の
一部として記述してはなりません（MUST NOT）。

## 過去の文書

仕様策定前のCore guideは[`archive/core-v0.8`](./archive/core-v0.8/README.md)に
保存しています。これは以前のHTML指向実装を説明する非規範的な資料です。
