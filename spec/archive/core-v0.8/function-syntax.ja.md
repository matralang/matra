# Matra v0.8 Function Syntax Guide

[English](./function-syntax.md) | [日本語](./function-syntax.ja.md)

> [!WARNING]
> この文書はCore v0.8のhistorical function syntax guideです。現在のMatra仕様では、現行specを優先してください。

## Overview

Function syntaxは、Matra treeを関数呼び出し風に書くための構文です。`tag(child1, child2, prop=value)`の形でelement、children、propertiesを表現します。

```matra
section(
  h1("Title"),
  p("Body"),
  class="content"
)
```

## Quick Comparison

### Block Syntax (v0.7)

```matra
article.card {
  h2 { "Title" }
  p { "Body" }
}
```

### Function Syntax (v0.8)

```matra
article({class:"card"}, h2("Title"), p("Body"))
```

## Syntax Reference

### Basic Element

```matra
p("Hello")
div()
```

### Element with Properties

Property objectまたはkeyword argumentでattributeを指定します。

```matra
a({href:"/", class:"link"}, "Home")
a("Home", href="/", class="link")
```

### Multiple Children

```matra
div(p("A"), p("B"), p("C"))
```

### Nested Elements

```matra
nav(ul(li("Home"), li("Docs")))
```

### Property Types

```matra
input(type="checkbox", checked=true, tabindex=1)
```

v0.8ではstring、number、booleanをproperty valueとして扱いました。

### Empty Elements

```matra
div()
br()
```

### Self-Closing Elements

HTML上のvoid elementも、Matraではchildrenなしのelementとして表します。

```matra
img(src="photo.png", alt="Photo")
```

## Integration with Template Features

### Mustache Interpolation

```matra
p("Hello, {{name}}")
a("{{label}}", href="{{url}}")
```

### Directive Support

```matra
p("Visible", m-if="show")
ul(li("{{item}}", m-each="items", m-as="item"))
```

Directiveはpropertyとして扱われ、transform段階で解釈されます。

## When to Use Which Syntax

### Use Block Syntax When

- documentやpage全体を書く
- selector shorthandを活用したい
- nestingが深い
- HTML-likeな見た目を優先したい

### Use Function Syntax When

- 小さなcomponentをinlineで書く
- childrenが少ないelementを短く書きたい
- code generationやprogrammaticな構造と相性を合わせたい
- propertyを明示的なargumentとして並べたい

## Examples

### Navigation Menu

```matra
nav({class:"menu"},
  ul(
    li(a({href:"/"}, "Home")),
    li(a({href:"/docs"}, "Docs")),
    li(a({href:"/play"}, "Play"))
  )
)
```

### Card Component

```matra
article({class:"card"},
  header(h2("{{title}}")),
  p("{{summary}}"),
  footer(a({href:"{{url}}"}, "Read more"))
)
```

### Form Elements

```matra
form({action:"/submit", method:"post"},
  label({for:"email"}, "Email"),
  input({id:"email", name:"email", type:"email", required:true}),
  button({type:"submit"}, "Send")
)
```

### Mixed Syntax

v0.8では、block syntaxとfunction syntaxを同じtemplate内で混在させることも想定されていました。

```matra
main {
  h1("Title")
  section {
    p("Body")
  }
}
```

## Grammar Details

```text
TagApply  -> Identifier "(" ArgList? ")"
ArgList   -> Arg ("," Arg)*
Arg       -> String / Number / Boolean / BareObject / TagApply
BareObject -> "{" PairList? "}"
```

## HAST Compatibility

Function syntaxはblock syntaxと同じHAST-compatible nodeを生成するよう設計されました。構文だけが違い、transformとrenderのpipelineは共有します。

## Migration Guide

Block syntaxからfunction syntaxへ移行する場合は、次の対応で置き換えます。

```matra
// Block
div.container { p { "Hello" } }

// Function
div({class:"container"}, p("Hello"))
```

深い構造を無理にfunction syntaxへ寄せる必要はありません。読みやすい箇所だけ採用できます。

## Performance

Function syntax自体は出力treeのshapeを変えないため、runtime performanceよりもparseとauthoring styleの違いが主な差です。頻繁にrenderするtemplateはcompile済みfunctionをcacheします。

## See Also

- [Quick Reference](./QUICK-REFERENCE.ja.md)
- [Syntax Comparison](./SYNTAX-COMPARISON.ja.md)
- [Syntax Modes Guide](./syntax-modes.ja.md)
