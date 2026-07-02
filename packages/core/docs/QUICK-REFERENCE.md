# Matra v0.8 Quick Reference

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
// Function syntax
compile('p({"m-if":"show"}, "Text")', { context: { show: true } })

// Block syntax
compile('p[m-if="show"] { "Text" }', { context: { show: true } })

// Both → <p>Text</p> (or empty if show=false)
```

### Array Iteration (m-each)

```javascript
// Function syntax
compile('ul(li({"m-each":"items", "m-as":"item"}, "{{item}}"))', {
  context: { items: ["A", "B", "C"] },
})

// Block syntax
compile('ul { li[m-each="items" m-as="item"] { "{{item}}" } }', {
  context: { items: ["A", "B", "C"] },
})

// Both → <ul><li>A</li><li>B</li><li>C</li></ul>
```

## When to Use Which

| Feature             | Function Syntax  | Block Syntax      |
| ------------------- | ---------------- | ----------------- |
| Concise inline      | ✅ Great         | ❌ Verbose        |
| Deep nesting        | ⚠️ Can get long  | ✅ Readable       |
| CSS-like selectors  | ❌ Not available | ✅ `.class #id`   |
| Programmatic        | ✅ Natural       | ⚠️ Less natural   |
| JSX-like            | ✅ Similar       | ❌ Different      |
| Attribute shortcuts | ❌ Full object   | ✅ `[attr="val"]` |

## Equivalence Examples

### Simple Element

```matra
// Function
p("Hello")

// Block
p { "Hello" }

// Both → <p>Hello</p>
```

### With Class

```matra
// Function
div({class:"container"}, "Content")

// Block
div.container { "Content" }

// Both → <div class="container">Content</div>
```

### With ID

```matra
// Function
h1({id:"title"}, "Main")

// Block
h1#title { "Main" }

// Both → <h1 id="title">Main</h1>
```

### Multiple Properties

```matra
// Function
a({href:"/", class:"link", target:"_blank"}, "Click")

// Block
a.link[href="/" target="_blank"] { "Click" }

// Both → <a href="/" class="link" target="_blank">Click</a>
```

## API Usage

```javascript
import { parse, compile } from "@matra/core"

// Parse function syntax
const ast = parse('p("Hello")')
// → { type: "element", tagName: "p", ... }

// Compile function syntax
const html = compile('div(p("A"), p("B"))')
// → <div><p>A</p><p>B</p></div>

// With context
const result = compile('h1("{{title}}")', {
  context: { title: "Welcome" },
})
// → <h1>Welcome</h1>
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

**Full docs**: [docs/function-syntax.md](function-syntax.md)  
**Examples**: [examples/function-syntax-demo.mjs](../examples/function-syntax-demo.mjs)  
**Tests**: [tests/function-syntax.test.mjs](../tests/function-syntax.test.mjs)
