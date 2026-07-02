# Matra v0.8 Function Syntax Guide

## Overview

Matra v0.8 introduces a new **function-style syntax** that provides an alternative way to write Matra templates. This syntax coexists with the existing block-style syntax, giving you the flexibility to choose the style that best fits your needs.

## Quick Comparison

### Block Syntax (v0.7)

```matra
div.container {
  h1#title { "Hello, World!" }
  p { "Welcome to Matra" }
}
```

### Function Syntax (v0.8)

```matra
div(
  h1("Hello, World!", id="title"),
  p("Welcome to Matra"),
  class="container"
)
```

Both produce the same output:

```html
<div class="container">
  <h1 id="title">Hello, World!</h1>
  <p>Welcome to Matra</p>
</div>
```

## Syntax Reference

### Basic Element

```matra
p("Hello, World!")
```

Output: `<p>Hello, World!</p>`

### Element with Properties

Write properties as Python-style keyword arguments. Positional children are
conventionally written first:

```matra
h1("Welcome", class="title", id="main")
```

Output: `<h1 class="title" id="main">Welcome</h1>`

### Multiple Children

Pass multiple arguments for multiple children:

```matra
div(p("First"), p("Second"), p("Third"))
```

Output: `<div><p>First</p><p>Second</p><p>Third</p></div>`

### Nested Elements

Function calls can be nested:

```matra
nav(ul(li(a("Home", href="/")), li(a("About", href="/about"))))
```

### Property Types

Properties support strings, numbers, and booleans:

```matra
input(type="checkbox", checked=true, tabindex=1)
```

Output: `<input type="checkbox" checked tabindex="1">`

### Empty Elements

Call with no arguments for empty elements:

```matra
div()
```

Output: `<div></div>`

### Self-Closing Elements

```matra
img(src="logo.png", alt="Logo")
```

Output: `<img src="logo.png" alt="Logo">`

## Integration with Template Features

### Mustache Interpolation

Function syntax works seamlessly with `{{variable}}` interpolation:

```javascript
import { compile } from "@matra/core"

const html = compile('div(h1("{{title}}"), p("{{content}}"))', {
  context: { title: "Hello", content: "World" },
})
// Output: <div><h1>Hello</h1><p>World</p></div>
```

### Directive Support

Use directives like `m-if` and `m-each` as properties:

```javascript
// m-if directive
const html = compile('p("Conditional", m-if="show")', {
  context: { show: true },
})
// Output: <p>Conditional</p>

// m-each directive
const html = compile('ul(li("{{item}}", m-each="items", m-as="item"))', {
  context: { items: ["A", "B", "C"] },
})
// Output: <ul><li>A</li><li>B</li><li>C</li></ul>
```

## When to Use Which Syntax

### Use Block Syntax When

- Working with deeply nested structures
- Want CSS-like selector convenience (`.class`, `#id`, `[attr="val"]`)
- Prefer visual hierarchy with indentation
- Writing template-heavy documents

### Use Function Syntax When

- Programmatic template generation
- Inline, concise expressions
- Working with JSX-like patterns
- Composing templates with JavaScript

## Examples

### Navigation Menu

```matra
nav({class:"main-nav"},
  ul({class:"nav-list"},
    li(a({href:"/", class:"nav-link"}, "Home")),
    li(a({href:"/products", class:"nav-link"}, "Products")),
    li(a({href:"/contact", class:"nav-link"}, "Contact"))
  )
)
```

### Card Component

```matra
article({class:"card"},
  header({class:"card-header"},
    h2({class:"card-title"}, "{{title}}")
  ),
  div({class:"card-body"},
    p("{{description}}")
  ),
  footer({class:"card-footer"},
    a({href:"{{link}}", class:"btn btn-primary"}, "Learn More")
  )
)
```

### Form Elements

```matra
form({action:"/submit", method:"post"},
  div({class:"form-group"},
    label({for:"email"}, "Email:"),
    input({type:"email", id:"email", name:"email", required:true})
  ),
  div({class:"form-group"},
    label({for:"password"}, "Password:"),
    input({type:"password", id:"password", name:"password", required:true})
  ),
  button({type:"submit", class:"btn btn-primary"}, "Login")
)
```

### Mixed Syntax

You can mix both syntaxes in different parts of your application:

```javascript
// Block syntax for the layout
const layout = compile(`
  div.container {
    header.site-header { h1 { "My Site" } }
  }
`)

// Function syntax for components
const button = compile('button({class:"btn btn-primary"}, "Click Me")')
```

## Grammar Details

The function syntax is parsed as `TagApply` in the PEG grammar:

```peggy
TagApply
  = tag:Identifier _ "(" _ args:ArgList? _ ")"
```

Where:

- `tag`: Element name (identifier)
- `args`: Optional comma-separated arguments
  - First argument as object → properties
  - Other arguments → children (text or nested elements)

## HAST Compatibility

Both syntaxes produce identical HAST nodes:

```javascript
{
  type: "element",
  tagName: "p",
  properties: { class: "text" },
  children: [
    { type: "text", value: "Hello" }
  ]
}
```

This ensures compatibility with the unified ecosystem and all existing Matra features.

## Migration Guide

No migration needed! v0.8 is fully backward compatible. Existing v0.7 templates continue to work unchanged. The function syntax is an additive feature.

## Performance

Both syntaxes have equivalent performance. Choose based on readability and maintainability for your use case.

## See Also

- [Matra Core README](../README.md)
- [Syntax Examples](../examples/function-syntax-demo.mjs)
- [API Reference](../docs/04-api-reference.md)
