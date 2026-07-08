# Syntax Modes Guide

[English](./syntax-modes.md) | [日本語](./syntax-modes.ja.md)

> [!WARNING]
> この文書はCore v0.8のhistorical syntax mode guideです。現在のMatra仕様とは異なる場合があります。

## Overview

Syntax modeは、Matra sourceで許可する構文の範囲を切り替えるための考え方です。v0.8では、block syntax、function syntax、text shorthandなどの表記が増えたため、projectの性質に応じて制限できる設計が検討されていました。

## Usage

### Specifying the Mode

Parserやcompiler optionでmodeを指定する形が想定されます。

```javascript
compile(source, { mode: "mixed" })
compile(source, { mode: "document" })
compile(source, { mode: "application" })
```

## Mode Details

### Mixed Mode (Default)

Mixed modeは、block syntaxとfunction syntaxを併用できるdefault modeです。移行期間や実験的なprojectに向いています。

```matra
main {
  h1("Title")
  p { "Body" }
}
```

### Document Mode

Document modeは、pageやdocument template向けにblock syntax中心の書き方を促します。深いnestingやselector shorthandを読みやすく保ちたい場合に向きます。

```matra
article.post {
  h1 { "{{title}}" }
  p { "{{body}}" }
}
```

### Application Mode

Application modeは、function syntax中心の書き方を促します。小さなcomponent、programmaticな生成、inline fragmentを多く扱うprojectに向きます。

```matra
article({class:"post"}, h1("{{title}}"), p("{{body}}"))
```

## Template Features

### Variable Interpolation

どのmodeでも、textやattribute内の`{{name}}` interpolationは利用できる想定でした。

```matra
p { "Hello, {{name}}" }
p("Hello, {{name}}")
```

### Directives (m-if, m-each)

Directiveもmodeにかかわらず使える機能として扱われます。ただし、modeによって推奨される記法は変わります。

```matra
p[m-if="show"] { "Text" }
p("Text", m-if="show")
```

## Use Cases

### Case 1: Static Site Generator (Document Mode)

長いpage templateではblock syntaxが読みやすく、content hierarchyをそのまま表現できます。

### Case 2: Component Library (Application Mode)

小さなcomponentを多数定義する場合はfunction syntaxが短く、compositionを追いやすくなります。

### Case 3: Flexible Framework (Mixed Mode)

既存templateの移行中や、pageとcomponentが混在するframeworkではmixed modeが便利です。

## Migration Guide

### From v0.7 (Block-only) to v0.8+

既存のblock syntaxはそのまま使えます。必要な箇所だけfunction syntaxへ置き換えます。

```matra
p { "Hello" }
p("Hello")
```

### Enforcing a Mode in Existing Projects

Project内でmodeを固定する場合は、CIやformatter、editor diagnosticsで別syntaxの使用を検出する方針が考えられます。

## Best Practices

### Do

- projectごとに推奨modeを決める
- document templateでは読みやすいindentationを保つ
- component fragmentではfunction syntaxを使いすぎない範囲で活用する
- migration中はmixed modeで段階的に移行する

### Don't

- 1つの小さなtemplate内で無意味にsyntaxを混在させない
- 深いtreeをすべて1行のfunction callに押し込めない
- syntax modeをbusiness logicの分岐に使わない

## Error Messages

Mode違反のerror messageでは、許可されていないsyntax、source位置、推奨される置き換えを示すと使いやすくなります。

```text
Function syntax is not allowed in document mode at line 3, column 5.
Use block syntax: p { "Hello" }
```

## See Also

- [Function Syntax Guide](./function-syntax.ja.md)
- [Syntax Comparison](./SYNTAX-COMPARISON.ja.md)
- [Backtick Text Syntax](./backtick-syntax.ja.md)
- [Tilde Syntax](./tilde-syntax.ja.md)
