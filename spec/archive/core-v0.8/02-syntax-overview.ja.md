# Syntax Overview

[English](./02-syntax-overview.md) | [日本語](./02-syntax-overview.ja.md)

> [!WARNING]
> この文書はCore v0.8のhistorical documentationです。現在のMatra構文とは異なる部分があります。

## Table of Contents

- [Basic Structure](#basic-structure)
- [Elements](#elements)
- [Attributes](#attributes)
- [Text Content](#text-content)
- [Directives](#directives)
- [Comments](#comments)
- [Whitespace Handling](#whitespace-handling)
- [Escaping](#escaping)
- [Complete Example](#complete-example)

## Basic Structure

Matra v0.8は、elementをnestしたtreeとしてtemplateを記述します。block syntaxでは`tag { ... }`、function syntaxでは`tag(...)`を使います。

```matra
div {
  h1 { "Title" }
  p { "Body" }
}
```

```matra
div(h1("Title"), p("Body"))
```

どちらも同じHTML treeを表します。

## Elements

### Basic Element Syntax

```matra
p { "Hello" }
```

```matra
p("Hello")
```

### Self-Closing Elements

childrenを持たないelementは空のblockまたはargumentなしのfunction callで表します。

```matra
br {}
img[src="photo.png" alt="Photo"] {}
```

```matra
br()
img(src="photo.png", alt="Photo")
```

### Nested Elements

```matra
article {
  header { h1 { "Title" } }
  section { p { "Content" } }
}
```

## Attributes

### Basic Attribute Syntax

Block syntaxではselector shorthandとattribute bracketを使えます。

```matra
a.link[href="/" target="_blank"] { "Home" }
```

Function syntaxではproperty objectまたはkeyword argumentで指定します。

```matra
a("Home", href="/", target="_blank", class="link")
```

### Attribute Values

Attribute valueはstring、number、booleanを扱えます。

```matra
input(type="checkbox", checked=true, tabindex=1)
```

### Dynamic Attributes

v0.8のtemplate transformationでは、context valueをinterpolationでattributeへ埋め込めます。

```matra
a[href="{{url}}"] { "{{label}}" }
```

## Text Content

### Plain Text

```matra
p { "Plain text" }
```

### Interpolated Text

```matra
p { "Hello, {{name}}" }
```

### Multiple Text Nodes

複数のtext nodeやelementをchildrenとして並べられます。

```matra
p {
  "Hello, "
  strong { "{{name}}" }
}
```

### Mixed Content

```matra
p("Read ", a("the guide", href="/docs"), " first.")
```

## Directives

### Attribute-Based Directives

```matra
p[m-if="show"] { "Visible" }
ul { li[m-each="items" m-as="item"] { "{{item}}" } }
```

### Tag-Based Directives

```matra
m-if[test="show"] {
  p { "Visible" }
}
```

Attribute-based directiveはregular elementに直接付けられるため、HTMLに近い構造を保ちやすい形式です。

## Comments

### Single-Line Comments

```matra
// comment
p { "Text" }
```

### Multi-Line Comments

```matra
/*
  comment block
*/
div {}
```

## Whitespace Handling

### Insignificant Whitespace

Element間のindentationや改行は構造を読みやすくするためのものとして扱います。

### Significant Whitespace

Text node内のspaceは出力に影響します。

```matra
p { "Hello world" }
```

### Controlling Whitespace

意図したspaceはtext literalの中に含めます。HTML layoutのためのindentationとは区別して扱います。

## Escaping

### Escaping Quotes

```matra
p { "She said \"Hello\"" }
```

### Escaping Interpolation

literalとして`{{`を出したい場合は、当時のparser / renderer実装のescape ruleに合わせて扱う必要がありました。

### HTML Entities

HTML entityはtextとして保持され、renderer側でHTMLとして出力されます。

```matra
p { "Tom &amp; Jerry" }
```

## Complete Example

```matra
article.card[data-id="{{id}}"] {
  h2 { "{{title}}" }
  p { "{{summary}}" }
  a.button[href="{{url}}"] { "Read more" }
}
```

## Next Steps

Directiveの詳細は[Directives](./03-directives.ja.md)、APIの使い方は[API Reference](./04-api-reference.ja.md)を参照してください。
