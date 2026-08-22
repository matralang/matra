# Matra Data Model v0.2

[English](./data-model.md) | [日本語](./data-model.ja.md) | [索引](./README.ja.md)

## Node

Matra文書はroot nodeをちょうど1つ表現します。nodeは次の順序付きtupleです。

1. `tag`: nodeを識別するstring
2. `props`: string keyからvalueへのmap
3. `children`: nodeまたはvalueの順序付きlist

tagとproperty keyはstringでなければなりません（MUST）。ドメイン固有の意味は
この仕様では定義しません。

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
