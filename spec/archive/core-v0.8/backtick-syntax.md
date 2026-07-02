# Backtick Text Syntax

Matra v0.8+ supports a concise **backtick syntax** for creating elements with simple text content, eliminating the need for curly braces and quotes.

## Overview

Instead of writing:

```matra
h1 { "Hello" }
```

You can now write:

```matra
h1`Hello`
```

This provides a cleaner, more readable syntax for simple text nodes, inspired by Pug's minimalist approach.

## Basic Usage

### Simple Text

```matra
h1`Hello, World!`
p`This is a paragraph`
span`Short text`
```

**Output:**

```html
<h1>Hello, World!</h1>
<p>This is a paragraph</p>
<span>Short text</span>
```

### With Class Selectors

```matra
div.container`Welcome to Matra`
p.intro.highlight`Important text`
```

**Output:**

```html
<div class="container">Welcome to Matra</div>
<p class="intro highlight">Important text</p>
```

### With ID Selectors

```matra
p#intro`This is an introduction`
div#main.container`Main content`
```

**Output:**

```html
<p id="intro">This is an introduction</p>
<div id="main" class="container">Main content</div>
```

### With Attributes

```matra
a[href="/"]`Home`
a.link[href="/" target="_blank"]`External Link`
```

**Output:**

```html
<a href="/">Home</a> <a href="/" target="_blank" class="link">External Link</a>
```

## Nested Usage

Backtick syntax works seamlessly within block syntax:

```matra
div.container {
  h1`Hello`
  p`Welcome!`
  a[href="/"]`Learn more`
}
```

**Output:**

```html
<div class="container">
  <h1>Hello</h1>
  <p>Welcome!</p>
  <a href="/">Learn more</a>
</div>
```

## Template Variables

Backtick syntax supports mustache interpolation:

```javascript
import { compile } from "@matra/core"

const html = compile("h1`Hello, {{name}}!`", {
  context: { name: "World" },
})
// Output: <h1>Hello, World!</h1>
```

### Multiple Variables

```matra
p`{{greeting}}, {{name}}!`
```

With context `{ greeting: "Hello", name: "Matra" }`:

**Output:**

```html
<p>Hello, Matra!</p>
```

## Comparison with Other Syntaxes

All three syntaxes produce identical output:

```javascript
// Backtick syntax (NEW in v0.8)
compile("p`Hello`")

// Block syntax with quotes
compile('p { "Hello" }')

// Function syntax
compile('p("Hello")')

// All produce: <p>Hello</p>
```

### When to Use Each

| Syntax                | Best For                           | Example                       |
| --------------------- | ---------------------------------- | ----------------------------- |
| **Backtick**          | Simple text nodes                  | `h1\`Title\``                 |
| **Block with quotes** | Complex content, multiple children | `div { "Text" p { "More" } }` |
| **Function**          | Programmatic generation            | `div({class: cls}, "Text")`   |

## Real-World Examples

### Blog Post Card

```matra
article.post-card {
  h2.title`Blog Post Title`
  p.excerpt`This is a short excerpt from the blog post...`
  a.read-more[href="/post/1"]`Read more →`
}
```

### Navigation Menu

```matra
nav.main-nav {
  ul.nav-list {
    li { a[href="/"]`Home` }
    li { a[href="/about"]`About` }
    li { a[href="/services"]`Services` }
    li { a[href="/contact"]`Contact` }
  }
}
```

### Hero Section

```matra
section#hero.hero {
  h1.hero-title`Welcome to Matra`
  p.hero-subtitle`A lightweight, expressive template language`
  a.btn.btn-primary[href="/get-started"]`Get Started`
}
```

## Syntax Modes

Backtick syntax is part of **Block syntax** and respects syntax modes:

```javascript
// Document mode: ✅ Allowed
compile("h1`Hello`", { mode: "document" })

// Application mode: ❌ Not allowed (Block syntax disabled)
compile("h1`Hello`", { mode: "application" })
// Error: Block syntax is not allowed in application mode

// Mixed mode (default): ✅ Allowed
compile("h1`Hello`")
```

## Special Characters

HTML special characters are automatically escaped:

```matra
p`<Hello> & 'Goodbye'`
```

**Output:**

```html
<p>&lt;Hello&gt; &amp; &#039;Goodbye&#039;</p>
```

## Benefits

### ✅ Advantages

- **Concise**: Fewer characters to type
- **Readable**: Cleaner syntax for simple text
- **Familiar**: Similar to Pug and template literals
- **Flexible**: Works with classes, IDs, and attributes

### 📝 Considerations

- Only for **simple text content**
- For complex content (multiple children, nested elements), use block syntax with `{}`
- Cannot mix backticks with other children in the same element

## Migration

No migration needed! This is an additive feature. Your existing code continues to work:

```matra
// Old way (still works)
h1 { "Hello" }

// New way (also works)
h1`Hello`
```

Both produce identical output.

## See Also

- [Syntax Modes Guide](./syntax-modes.md)
- [Function Syntax Guide](./function-syntax.md)
- [Syntax Comparison](./SYNTAX-COMPARISON.md)
- [Quick Reference](./QUICK-REFERENCE.md)
