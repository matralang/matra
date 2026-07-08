# Matra Syntax Comparison: Block vs Function

[English](./SYNTAX-COMPARISON.md) | [日本語](./SYNTAX-COMPARISON.ja.md)

> [!WARNING]
> この文書はCore v0.8のhistorical syntax comparisonです。

## Side-by-Side Examples

### Simple Element with Text

```matra
// Block
p { "Hello" }

// Function
p("Hello")
```

### Element with Class

```matra
// Block
div.container { "Content" }

// Function
div({class:"container"}, "Content")
```

### Element with ID

```matra
// Block
h1#title { "Main" }

// Function
h1({id:"title"}, "Main")
```

### Multiple Properties

```matra
// Block
a.link[href="/" target="_blank"] { "Click" }

// Function
a({href:"/", class:"link", target:"_blank"}, "Click")
```

### Nested Elements

```matra
// Block
nav {
  ul {
    li { "Home" }
  }
}

// Function
nav(ul(li("Home")))
```

### Multiple Children

```matra
// Block
div {
  p { "A" }
  p { "B" }
}

// Function
div(p("A"), p("B"))
```

### Complex Nesting

深い構造ではblock syntaxのほうがindentationで構造を追いやすく、短いinline fragmentではfunction syntaxが簡潔です。

## Real-World Examples

### Navigation Menu

```matra
nav.menu {
  ul {
    li { a[href="/"] { "Home" } }
    li { a[href="/docs"] { "Docs" } }
  }
}
```

```matra
nav({class:"menu"}, ul(
  li(a({href:"/"}, "Home")),
  li(a({href:"/docs"}, "Docs"))
))
```

### Card Component

```matra
article.card {
  h2 { "{{title}}" }
  p { "{{summary}}" }
}
```

```matra
article({class:"card"}, h2("{{title}}"), p("{{summary}}"))
```

### Form

```matra
form[action="/submit" method="post"] {
  input[type="email" name="email"] {}
  button[type="submit"] { "Send" }
}
```

```matra
form({action:"/submit", method:"post"},
  input({type:"email", name:"email"}),
  button({type:"submit"}, "Send")
)
```

## Template Features Comparison

### Variable Interpolation

Both syntaxes support `{{name}}` in text and attributes.

```matra
p { "Hello, {{name}}" }
p("Hello, {{name}}")
```

### Conditional Rendering (m-if)

```matra
p[m-if="show"] { "Text" }
p({"m-if":"show"}, "Text")
```

### Array Iteration (m-each)

```matra
li[m-each="items" m-as="item"] { "{{item}}" }
li({"m-each":"items", "m-as":"item"}, "{{item}}")
```

## Advantages of Each Syntax

### Block Syntax Advantages

- CSS-like selector shorthandが使える
- 深いnestingをindentationで読みやすくできる
- document templateに向いている
- attribute bracketがHTMLに近い

### Function Syntax Advantages

- inline fragmentが短く書ける
- nested callとしてprogrammaticに読める
- JavaScript / Python風のkeyword argumentに近い
- expression-orientedなstyleに向いている

## Which Should I Use?

### Use Block Syntax When

- pageやdocument全体を書く
- selector shorthandを多用する
- 深いHTML構造を扱う

### Use Function Syntax When

- 小さなcomponentやinline structureを書く
- code generatorやprogrammaticな生成と組み合わせる
- propertyを明示的に並べたい

### Mix Both When

v0.8では両syntaxを混在できる想定でした。ただし、team内ではformatting ruleと使い分けを決めると読みやすさを保てます。

## Key Takeaway

Block syntaxはdocument-like、function syntaxはexpression-likeです。どちらも同じtreeを表すため、出力ではなく読みやすさで選びます。
