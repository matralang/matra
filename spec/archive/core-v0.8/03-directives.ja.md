# Directives

[English](./03-directives.md) | [日本語](./03-directives.ja.md)

> [!WARNING]
> この文書はCore v0.8のHTML template directiveに関するhistorical documentationです。

Directiveは、context dataに基づいてtreeを変換するための特別な属性またはtagです。v0.8では、主にconditional renderingとarray iterationを扱っていました。

## Conditional Rendering

### `m-if` Directive

`m-if`は、context上の値がtruthyのときだけelementを残します。

```matra
p[m-if="loggedIn"] { "Welcome back" }
```

```javascript
compile('p[m-if="loggedIn"] { "Welcome back" }', {
  context: { loggedIn: true },
})
// <p>Welcome back</p>
```

Function syntaxではpropertyとして指定します。

```matra
p("Welcome back", m-if="loggedIn")
```

### `m-else` Directive

`m-else`は直前の`m-if`がfalsyだったときに使うalternative branchです。

```matra
p[m-if="loggedIn"] { "Welcome back" }
p[m-else] { "Please sign in" }
```

## Array Iteration

### `m-each` Directive

`m-each`はarrayを反復し、各itemごとにelementを複製します。`m-as`でitem名を指定します。

```matra
ul {
  li[m-each="items" m-as="item"] { "{{item}}" }
}
```

```javascript
compile(template, { context: { items: ["A", "B", "C"] } })
// <ul><li>A</li><li>B</li><li>C</li></ul>
```

### Iteration with Objects

Array要素がobjectの場合はproperty pathで参照します。

```matra
li[m-each="users" m-as="user"] {
  "{{user.name}}"
}
```

### Index Variable

v0.8 documentationではindex variableの利用も想定していました。実装に依存するため、使用時は当時のtest snapshotを確認してください。

```matra
li[m-each="items" m-as="item"] { "{{item}}" }
```

### Custom Index Name

Custom index名はtemplateの読みやすさを保つため、listの意味に合わせた名前を選びます。

## Nested Directives

Directiveはnestできます。外側の`m-each`でscopeが作られ、内側の`m-if`がそのitemを参照します。

```matra
ul {
  li[m-each="users" m-as="user" m-if="user.active"] {
    "{{user.name}}"
  }
}
```

## Directive Priority

v0.8ではattribute-based directiveをtag-based directiveより優先する方向に実装が更新されました。複数directiveを同じnodeに置く場合は、conditionで除外される前にiteration scopeが必要かどうかを意識します。

## Best Practices

### Choose the Right Style

通常のHTML elementに付く条件や反復はattribute-based styleが読みやすくなります。構造上のbranchを大きく包む場合はtag-based styleも選択肢です。

### Avoid Deep Nesting

Directiveを深くnestしすぎると、context scopeと出力HTMLの対応が追いにくくなります。複雑な条件はcontext helperへ寄せます。

### Name Variables Clearly

`item`よりも`user`、`post`、`product`のようなdomain名を使うとtemplateが読みやすくなります。

## Error Handling

### Missing Context Variables

存在しないcontext variableを参照した場合、空文字やfalsyとして扱われることがあります。重要な値はcompile前にvalidateしてください。

### Non-Array in `m-each`

`m-each`の対象がarrayでない場合は反復できません。data boundaryでarrayに正規化するのが安全です。

## Performance Considerations

大きいlistをrenderする場合は、templateを毎回parseせずcompile済みfunctionを再利用します。条件やhelperはcontextで計算済みにしておくと、template transformationを単純に保てます。
