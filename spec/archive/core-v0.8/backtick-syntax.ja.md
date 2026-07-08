# Backtick Text Syntax

[English](./backtick-syntax.md) | [日本語](./backtick-syntax.ja.md)

> [!WARNING]
> この文書はCore v0.8のhistorical syntax noteです。現在のMatra仕様とは異なる場合があります。

## Overview

Backtick text syntaxは、text contentを短く書くための記法として検討・記録されていました。通常のquoted stringよりも、短いtext fragmentをelementに結び付けやすくする意図があります。

## Basic Usage

### Simple Text

```matra
p `Hello world`
```

通常のblock syntaxでは次と同じ意味を持つ想定です。

```matra
p { "Hello world" }
```

### With Class Selectors

```matra
p.lead `Intro text`
```

### With ID Selectors

```matra
h1#title `Welcome`
```

### With Attributes

```matra
a[href="/"] `Home`
```

## Nested Usage

Backtick textはleaf elementに向いています。childrenを複数持つ構造ではblock syntaxやfunction syntaxを使う方が明確です。

```matra
article {
  h2 `Title`
  p `Summary`
}
```

## Template Variables

```matra
p `Hello, {{name}}`
```

### Multiple Variables

```matra
p `{{firstName}} {{lastName}}`
```

## Comparison with Other Syntaxes

```matra
p `Hello`
p { "Hello" }
p("Hello")
```

### When to Use Each

- backtick: 短いtext-only element
- block: nested document structure
- function: inline componentやprogrammaticな構造

## Real-World Examples

### Blog Post Card

```matra
article.card {
  h2 `{{post.title}}`
  p `{{post.summary}}`
}
```

### Navigation Menu

```matra
nav {
  a[href="/"] `Home`
  a[href="/docs"] `Docs`
}
```

### Hero Section

```matra
section.hero {
  h1 `{{headline}}`
  p `{{subhead}}`
}
```

## Syntax Modes

Syntax modeによっては、backtick textを許可するかどうかを制御する設計が想定されていました。厳格なdocument modeでは使用範囲を限定する選択もあります。

## Special Characters

Backtick自体をtextに含める場合はescape ruleが必要です。historical syntaxであるため、利用する場合は当時のparser testを確認してください。

## Benefits

### Advantages

- text-only elementを短く書ける
- selector shorthandと組み合わせやすい
- document templateの視覚的なnoiseを減らせる

### Considerations

- long textには向かない
- escape ruleを理解する必要がある
- current specificationでは規範的構文ではない

## Migration

Backtick syntaxを避けたい場合は、quoted textを使うblock syntaxまたはfunction syntaxへ置き換えます。

```matra
p `Hello`

p { "Hello" }
p("Hello")
```

## See Also

- [Syntax Modes Guide](./syntax-modes.ja.md)
- [Function Syntax Guide](./function-syntax.ja.md)
- [Syntax Comparison](./SYNTAX-COMPARISON.ja.md)
