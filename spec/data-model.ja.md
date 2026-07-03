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

`children`内でこの形に一致する3要素配列はnodeとして解釈します。producerは
MatraJSON nodeと区別できないvalue配列を避けるべきです（SHOULD）。

`props`内の式nodeも同じ3要素のMatraJSON形式を使います。object形式の
ASTでは、object形式のnodeとして保持します。

## 等価性

2つのMatra文書は、tag、propertyのkeyとvalue、child value、childの順序が
再帰的に等しい場合にdata model上で等価です。propertyのserialize順序は
意味を持ちません。

## ドメインの意味論

data modelはrendering、interpolation、directive、tagの動作を定義しません。
domainはtree構築後にそのtreeを解釈できます（MAY）。
