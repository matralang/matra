# Matra v0.8 Quick Reference

[English](./QUICK-REFERENCE.md) | [日本語](./QUICK-REFERENCE.ja.md)

> [!WARNING]
> これはCore v0.8向けのhistorical quick referenceです。

## Function Syntax (NEW in v0.8)

### Basic Elements

```matra
p("Hello")                              → <p>Hello</p>
div()                                   → <div></div>
```

### With Properties (Python-style Keyword Arguments)

```matra
h1("Text", class="title")             → <h1 class="title">Text</h1>
img(src="cat.png", alt="Cat")         → <img src="cat.png" alt="Cat">
```

### Multiple Children

```matra
div(p("A"), p("B"), p("C"))            → <div><p>A</p><p>B</p><p>C</p></div>
```

### Nested Calls

```matra
nav(ul(li("Home"), li("About")))       → <nav><ul><li>Home</li><li>About</li></ul></nav>
```

### Property Types

```matra
input(
  type="checkbox",                     // string
  checked=true,                         // boolean
  tabindex=1                            // number
)
```

## Block Syntax (v0.7, still supported)

### Basic Elements

```matra
p { "Hello" }                          → <p>Hello</p>
div {}                                 → <div></div>
```

### With Selectors

```matra
h1.title#main { "Text" }               → <h1 class="title" id="main">Text</h1>
div.container.fluid { "Content" }      → <div class="container fluid">Content</div>
```

### With Attributes

```matra
a[href="/home" target="_blank"] { "Link" } → <a href="/home" target="_blank">Link</a>
```

### Nested Blocks

```matra
div {
  p { "A" }
  p { "B" }
}
```

## Template Features (Both Syntaxes)

### Variable Interpolation

```javascript
compile('p("Hello, {{name}}")', { context: { name: "World" } })
// → <p>Hello, World</p>
```

### Conditional Rendering (m-if)

```javascript
compile('p({"m-if":"show"}, "Text")', { context: { show: true } })
compile('p[m-if="show"] { "Text" }', { context: { show: true } })
```

### Array Iteration (m-each)

```javascript
compile('ul(li({"m-each":"items", "m-as":"item"}, "{{item}}"))', {
  context: { items: ["A", "B", "C"] },
})
```

## When to Use Which

| Feature | Function Syntax | Block Syntax |
| --- | --- | --- |
| Concise inline | 得意 | 冗長になりやすい |
| Deep nesting | 長くなりやすい | 読みやすい |
| CSS-like selectors | なし | `.class #id`が使える |
| Programmatic | 自然 | ややtemplate寄り |
| JSX-like | 近い | 違いが大きい |
| Attribute shortcuts | 明示的に書く | `[attr="val"]`が使える |

## Equivalence Examples

### Simple Element

```matra
p("Hello")
p { "Hello" }
```

### With Class

```matra
div({class:"container"}, "Content")
div.container { "Content" }
```

### With ID

```matra
h1({id:"title"}, "Main")
h1#title { "Main" }
```

### Multiple Properties

```matra
a({href:"/", class:"link", target:"_blank"}, "Click")
a.link[href="/" target="_blank"] { "Click" }
```

## API Usage

```javascript
import { parse, compile } from "@matra/core"

const ast = parse('p("Hello")')
const html = compile('div(p("A"), p("B"))')
const result = compile('h1("{{title}}")', {
  context: { title: "Welcome" },
})
```

## Common Patterns

### Navigation

```matra
nav({class:"menu"},
  ul(
    li(a({href:"/"}, "Home")),
    li(a({href:"/about"}, "About")),
    li(a({href:"/contact"}, "Contact"))
  )
)
```

### Card Component

```matra
article({class:"card"},
  header(h2("{{title}}")),
  div({class:"body"}, "{{content}}"),
  footer(a({href:"{{link}}"}, "More"))
)
```

### Form

```matra
form({action:"/submit", method:"post"},
  input({type:"text", name:"username", required:true}),
  input({type:"password", name:"password", required:true}),
  button({type:"submit"}, "Login")
)
```

---

**Full docs**: [Function Syntax Guide](./function-syntax.ja.md)  
**Examples**: [Examples](./06-examples.ja.md)
