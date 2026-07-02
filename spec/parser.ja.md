# Matra Parser v0.1

[English](./parser.md) | [日本語](./parser.ja.md) | [索引](./README.ja.md)

## 契約

parserはMatraソーステキストを受け取り、[data model](./data-model.ja.md)と等価な
treeを返します。最小interfaceは次のとおりです。

```ts
interface MatraParser<Output = MatraAST | MatraJSON> {
  parse(source: string, options?: ParseOptions): Output
}
```

parserはMatraJSONまたはobject形式のASTを返すことができます（MAY）。consumerは
どちらの表現もASTへ正規化できます（MAY）。

## Parse操作

適合するparserは呼び出しごとに次を実行しなければなりません（MUST）。

1. root expressionをちょうど1つと、その前後のwhitespaceをすべて消費する
2. 不正なソースまたは末尾に非whitespace textがあるソースを拒否する
3. tagとpropertyのtextを保持する
4. childの順序とliteralの型を保持する
5. Data Model仕様とAST仕様に適合するtreeを返す

関数構文のproperty名重複はparse errorにしなければなりません（MUST）。keyword
propertyと互換object propertyの組み合わせによる重複も含みます。

## 構文モード

parserは`syntaxMode`を提供できます（MAY）。

| Mode | 使用できる構文 |
| --- | --- |
| `mixed` | 関数構文と文書構文 |
| `document` | 文書構文のみ |
| `application` | 関数構文のみ |

modeを実装する場合は`mixed`をdefaultにしなければなりません（MUST）。`document`
modeのfunction nodeと`application` modeのdocument nodeはparse errorにしなければ
なりません（MUST）。mode制限によって結果のdata modelが変化することはありません。

## エラー

parse失敗は成功した出力と区別できなければなりません（MUST）。errorはソース位置と
有用なmessageを含むべきです（SHOULD）。具体的なerror classとmessage文言は実装定義
です。

syntax、property重複、modeのerror後に、parserが部分的なtreeを成功結果として返しては
なりません（MUST NOT）。

## 交換可能性

同じv0.1ソースのsubsetを受理し、data model上で等価な出力を生成するparser実装は
交換可能です。consumerはparser内部のnode identityやgrammar engineの詳細に依存しては
なりません（MUST NOT）。

## 適合例

```matra
sum(value("a"), 2, axis="x")
```

上記は次と等価なtreeを生成しなければなりません（MUST）。

```json
["sum", { "axis": "x" }, [["value", {}, ["a"]], 2]]
```

次は`axis`が重複するため失敗しなければなりません（MUST）。

```matra
sum(axis="x", axis="y")
```
