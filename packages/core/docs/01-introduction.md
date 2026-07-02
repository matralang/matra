# Introduction to Matra

## What is Matra?

Matra is a **lightweight template language** designed for generating HTML with an intuitive, CSS-like syntax. It combines the simplicity of template engines like Mustache with the power of modern frameworks like Vue and React.

## Design Philosophy

### 1. **Familiar Syntax**

Matra uses CSS selector syntax that web developers already know:

```matra
div.container#main { h1.title { "Hello" } }
```

### 2. **Minimal Learning Curve**

- CSS-like selectors for elements
- `{{mustache}}` for variables
- Intuitive directive names (`m-if`, `m-each`)

### 3. **Zero Dependencies**

Pure ESM module with no external dependencies. Perfect for:

- Static site generators
- Server-side rendering
- Build tools
- Canvas rendering (via MatraMagica)

## Use Cases

### Static Site Generation

```javascript
import { compile } from '@matra/core'

const pages = posts.map(post => {
  return compile('article { h1 { "{{title}}" } {{content}} }', {
    context: post
  })
})
```

### Component Libraries

```javascript
import { with_ } from '@matra/core'

export const Card = with_(`
  div.card {
    h3 { "{{title}}" }
    p { "{{description}}" }
  }
`)

const html = Card({ title: 'Hello', description: 'World' })
```

### Dynamic HTML Generation

```javascript
const template = `
  ul.items {
    li[m-each="items" m-as="item"] { "{{item}}" }
  }
`
```

## Comparison with Other Template Engines

| Feature | Matra | Mustache | Pug | JSX |
| ------- | ----- | -------- | --- | --- |
| CSS-like Syntax | ✅ | ❌ | ✅ | ❌ |
| Conditionals | ✅ | ✅ | ✅ | ✅ |
| Loops | ✅ | ✅ | ✅ | ✅ |
| Zero Dependencies | ✅ | ✅ | ❌ | ❌ |
| HAST Compatible | ✅ | ❌ | ❌ | ✅ |
| Attribute Directives | ✅ | ❌ | ❌ | ✅ |

## Key Features

### 🎯 Simple Syntax

No angle brackets or verbose tags:

```matra
div { h1 { "Title" } }
```

vs HTML:

```html
<div><h1>Title</h1></div>
```

### 🔀 Two Directive Styles

Choose the style that fits your use case:

**Tag-based (for complex logic):**

```matra
m-if[test="isLoggedIn"] {
  nav.user-menu { ... }
}
```

**Attribute-based (for simple conditions):**

```matra
div.notice[m-if="showNotice"] { "Important!" }
```

### 📝 Powerful Interpolation

- Variables: `{{name}}`
- Nested properties: `{{user.profile.email}}`
- Array indices: `{{index}}`

### 🌳 AST-Based

Matra compiles to an Abstract Syntax Tree (AST), making it:

- Easy to transform
- Compatible with unified/remark ecosystem
- Suitable for advanced processing

## Getting Started

Install:

```bash
npm install @matra/core
```

Your first template:

```javascript
import { compile } from '@matra/core'

const html = compile('div { "Hello, World!" }')
console.log(html)
// <div>Hello, World!</div>
```

Next: [Syntax Overview](./02-syntax-overview.md)
