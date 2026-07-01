# @butchi/matra-core

[![Version](https://img.shields.io/badge/version-0.8.1-blue.svg)](https://github.com/butchi/matra-core)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

**Matra** is a lightweight, expressive template language and engine for generating HTML, with support for conditional rendering, loops, and variable interpolation.

## ✨ Features

- 🎨 **Four Syntax Styles** - Block, Function, Backtick, and Tilde syntax - **NEW Tilde in v0.8!**
- 🔒 **Syntax Modes** - Enforce consistent syntax across your project - **NEW in v0.8!**
- ✨ **Concise Text Syntax** - `h1\`Hello\``or`h1~Hello~`instead of`h1 { "Hello" }` - **NEW in v0.8!**
- 🎯 **Simple & Expressive** - Choose the style that fits your needs
- 🔀 **Conditional Rendering** - `m-if`, `m-else` directives (both tag and attribute styles)
- 🔁 **Array Iteration** - `m-each` directive with scoped variables
- 📝 **Variable Interpolation** - `{{mustache}}` style templates
- 🏷️ **Two Directive Styles** - Tag-based (`m-if[test="..."]`) and attribute-based (`div[m-if="..."]`)
- 🌳 **HAST Compatible** - Works with unified ecosystem
- 📦 **Zero Dependencies** - Pure ESM module

## 🆕 New in v0.8: Multiple Syntax Styles

Choose between **block syntax**, **function syntax**, **backtick syntax**, or **tilde syntax**:

```javascript
// Block syntax with quotes (v0.7)
compile('div.container { h1 { "Hello" } }')

// Backtick syntax - NEW & CONCISE! (v0.8)
compile("div.container { h1`Hello` }")

// Tilde syntax - ALTERNATIVE CONCISE SYNTAX! (v0.8)
compile("div.container { h1~Hello~ }")

// Function syntax (v0.8)
compile('div({class:"container"}, h1("Hello"))')

// All produce: <div class="container"><h1>Hello</h1></div>
```

Both **backtick** and **tilde** syntax provide clean ways to write simple text content!

See [Backtick Syntax Guide](./docs/backtick-syntax.md) | [Tilde Syntax Guide](./docs/tilde-syntax.md) | [Function Syntax Guide](./docs/function-syntax.md) | [Syntax Modes](./docs/syntax-modes.md) | [Quick Reference](./docs/QUICK-REFERENCE.md) | [Syntax Comparison](./docs/SYNTAX-COMPARISON.md)

## 📦 Installation

```bash
npm install @butchi/matra-core
```

## 🚀 Quick Start

### Basic Usage (Block Syntax)

```javascript
import { compile } from "@butchi/matra-core"

const html = compile('div.greeting { h1 { "Hello, World!" } }')
console.log(html)
// Output: <div class="greeting"><h1>Hello, World!</h1></div>
```

### Basic Usage (Backtick Syntax) - NEW & CONCISE in v0.8

```javascript
import { compile } from "@butchi/matra-core"

const html = compile("div.greeting { h1`Hello, World!` }")
console.log(html)
// Output: <div class="greeting"><h1>Hello, World!</h1></div>
```

### Basic Usage (Tilde Syntax) - ALTERNATIVE CONCISE SYNTAX in v0.8

```javascript
import { compile } from "@butchi/matra-core"

const html = compile("div.greeting { h1~Hello, World!~ }")
console.log(html)
// Output: <div class="greeting"><h1>Hello, World!</h1></div>
```

### Basic Usage (Function Syntax) - NEW in v0.8

```javascript
import { compile } from "@butchi/matra-core"

const html = compile('div({class:"greeting"}, h1("Hello, World!"))')
console.log(html)
// Output: <div class="greeting"><h1>Hello, World!</h1></div>
```

### With Template Variables

```javascript
import { compile } from "@butchi/matra-core"

const template = 'div { h1 { "Hello, {{name}}!" } p { "Age: {{age}}" } }'
const html = compile(template, {
  context: { name: "Butchi", age: 30 },
})
console.log(html)
// Output: <div><h1>Hello, Butchi!</h1><p>Age: 30</p></div>
```

### Using `with_()` for Reusable Templates

```javascript
import { with_ } from "@butchi/matra-core"

// Create a template function
const tmpl = with_({ items: ["Apple", "Banana", "Cherry"] })

// Use with template literal syntax
const html = tmpl`
  ul.fruits {
    li[m-each="items" m-as="item"] { "{{item}}" }
  }
`
console.log(html)
// Output: <ul class="fruits"><li>Apple</li><li>Banana</li><li>Cherry</li></ul>
```

## 📖 Syntax Guide

Matra v0.8 supports two equivalent syntax styles:

### Block Syntax (CSS-like)

```matra
div.container { h1#title { "Hello" } }
```

### Function Syntax (JSX-like)

```matra
div({class:"container"}, h1({id:"title"}, "Hello"))
```

### Both produce

```html
<div class="container"><h1 id="title">Hello</h1></div>
```

**Choose the style you prefer!** See [Syntax Comparison](./docs/SYNTAX-COMPARISON.md) for detailed examples.

### Attributes

```matra
a[href="/home" target="_blank"] { "Go Home" }
```

↓

```html
<a href="/home" target="_blank">Go Home</a>
```

### Conditional Rendering (Attribute Style)

```javascript
const html = compile('div[m-if="isActive"] { "Active" }', {
  context: { isActive: true },
})
// Output: <div>Active</div>
```

```javascript
const html = compile('div[m-if="isActive"] { "Active" }', {
  context: { isActive: false },
})
// Output: (empty)
```

### Conditional with `m-else`

```javascript
const template = `
  div {
    p[m-if="isLoggedIn"] { "Welcome back!" }
    m-else { p { "Please login" } }
  }
`
const html = compile(template, { context: { isLoggedIn: false } })
// Output: <div><p>Please login</p></div>
```

### Array Iteration

```javascript
const template = `
  ul.todos {
    li[m-each="items" m-as="item"] {
      "{{item.title}}: {{item.done}}"
    }
  }
`
const html = compile(template, {
  context: {
    items: [
      { title: "Task 1", done: true },
      { title: "Task 2", done: false },
    ],
  },
})
// Output:
// <ul class="todos">
//   <li>Task 1: true</li>
//   <li>Task 2: false</li>
// </ul>
```

### Nested Properties

```javascript
const template = 'div { h1 { "{{user.profile.name}}" } }'
const html = compile(template, {
  context: {
    user: {
      profile: { name: "Butchi" },
    },
  },
})
// Output: <div><h1>Butchi</h1></div>
```

## 📚 API Reference

### `parse(source, options?)`

Parse Matra source code into AST.

```javascript
import { parse } from "@butchi/matra-core"

const ast = parse('div { "Hello" }')
```

**Parameters:**

- `source` (string) - Matra source code
- `options.grammarSource` (string) - Source name for error messages

**Returns:** AST object

### `compile(source, options?)`

Parse, transform (with context), and render to HTML.

```javascript
import { compile } from "@butchi/matra-core"

const html = compile('div { "{{msg}}" }', {
  context: { msg: "Hello" },
})
```

**Parameters:**

- `source` (string) - Matra source code
- `options.context` (object) - Template variables
- `options.minify` (boolean) - Minify HTML output
- `options.grammarSource` (string) - Source name for error messages
- `options.mode` (`'mixed'|'document'|'application'`) - Syntax mode (default: `'mixed'`)
  - `'mixed'`: Both Block and Function syntax allowed (default)
  - `'document'`: Block syntax only (Pug-style with `.class`, `#id`, `[attr]`)
  - `'application'`: Function syntax only (JSX-style)

**Returns:** HTML string

### `transform(ast, context)`

Apply template transformations (directives, interpolation) to AST.

```javascript
import { parse, transform, toHTML } from "@butchi/matra-core"

const ast = parse('div[m-if="show"] { "Visible" }')
const transformed = transform(ast, { show: true })
const html = toHTML(transformed)
```

**Parameters:**

- `ast` (object) - AST from `parse()`
- `context` (object) - Template variables

**Returns:** Transformed AST

### `with_(context)`

Create a reusable template function with context.

```javascript
import { with_ } from "@butchi/matra-core"

const tmpl = with_({ name: "World" })

// Both syntaxes work:
const html1 = tmpl('div { "Hello, {{name}}!" }')
const html2 = tmpl`div { "Hello, {{name}}!" }`
```

**Parameters:**

- `context` (object) - Template variables

**Returns:** Function that accepts template source (string or template literal)

### `toHTML(ast, options?)`

Render AST to HTML string.

```javascript
import { parse, toHTML } from "@butchi/matra-core"

const ast = parse('div { "Hello" }')
const html = toHTML(ast)
```

**Parameters:**

- `ast` (object) - AST object
- `options.minify` (boolean) - Minify HTML output

**Returns:** HTML string

### `toJSON(ast, options?)`

Serialize AST to JSON string.

```javascript
import { parse, toJSON } from "@butchi/matra-core"

const ast = parse('div { "Hello" }')
const json = toJSON(ast, { indent: 2 })
```

**Parameters:**

- `ast` (object) - AST object
- `options.indent` (number) - JSON indentation

**Returns:** JSON string

## 🎭 Directive Styles

Matra supports two styles for directives:

### Tag-Based (v0.6+)

```matra
m-if[test="condition"] {
  div { "Content" }
}
```

### Attribute-Based (v0.7+)

```matra
div[m-if="condition"] { "Content" }
```

Both styles work identically. Attribute-based style is more concise when wrapping a single element.

## 🔧 Advanced Usage

### Multiple Directives

```javascript
const template = `
  section.products {
    div[m-each="products" m-as="product"] {
      h3 { "{{product.name}}" }
      p[m-if="product.inStock"] { "In Stock" }
      m-else { p { "Out of Stock" } }
      span.price { "${{product.price}}" }
    }
  }
`

const html = compile(template, {
  context: {
    products: [
      { name: 'Apple', price: 1.2, inStock: true },
      { name: 'Banana', price: 0.8, inStock: false }
    ]
  }
})
```

### Index in Loops

The `index` variable is automatically available in `m-each`:

```javascript
const template = `
  ol {
    li[m-each="items" m-as="item"] { "Item {{index}}: {{item}}" }
  }
`

const html = compile(template, {
  context: { items: ["A", "B", "C"] },
})
// Output:
// <ol>
//   <li>Item 0: A</li>
//   <li>Item 1: B</li>
//   <li>Item 2: C</li>
// </ol>
```

## 🧪 Testing

```bash
# Run basic parser test
node test-matra-core.mjs

# Run template features test
node test-matra-template.mjs

# Run attribute directives test
node test-matra-attr-directive.mjs
node test-matra-attr-transform.mjs
```

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

MIT © butchi

## 🔗 Related Projects

- [jp-butchi](https://github.com/butchi/jp-butchi) - Personal website built with Matra (130+ pages)
- [MatraMagica](https://github.com/butchi/matra-magica) - Canvas-based visual rendering (upcoming)

## 💡 Examples

More examples can be found in:

- [test-matra-template.mjs](./test-matra-template.mjs) - Template features
- [test-work-card-template.mjs](./test-work-card-template.mjs) - Real-world component example

---

Made with ❤️ by [butchi](https://butchi.jp)
