# Matra AST v0.1

[English](./ast.md) | [日本語](./ast.ja.md) | [索引](./README.ja.md)

## 目的

ASTはvisitor、transformer、rendererが使用するobject形式のメモリ内表現です。
[MatraJSON](./data-model.ja.md#matrajson)と同じ情報を表現し、別のdata modelでは
ありません。

## 形式

```ts
type MatraScalar = string | number | boolean | null
type MatraValue =
  | MatraScalar
  | MatraValue[]
  | { [key: string]: MatraValue }

interface MatraAST {
  tag: string
  props: Record<string, MatraValue>
  children: Array<MatraAST | MatraValue>
}
```

AST nodeは意味上のfieldとして`tag`、`props`、`children`を持たなければなりません
（MUST）。実装はmetadataを追加できますが（MAY）、metadataによってMatra data
modelの値を変更してはなりません（MUST NOT）。

## 例

```ts
{
  tag: "group",
  props: { role: "list" },
  children: [
    { tag: "item", props: {}, children: ["one"] },
    { tag: "item", props: {}, children: ["two"] },
  ],
}
```

## 変換

ASTとMatraJSONの変換は再帰的で、Matra data modelについて情報を失わないもので
なければなりません（MUST）。

```text
AST node                         MatraJSON node
{ tag, props, children }   <->   [tag, props, children]
```

変換ではtag text、property value、scalar型、入れ子のnode、child順序を保持しなければ
なりません（MUST）。変換によって入力を意図せず共有しないよう、実装は可変listと
mapをcopyすべきです（SHOULD）。

## 検証

AST validatorは次の場合にnodeを拒否しなければなりません（MUST）。

- `tag`がstringでない
- `props`がMatra valueを持つstring-keyed mapでない
- `children`がlistでない
- childがAST nodeでもMatra valueでもない
