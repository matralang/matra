# Syntax Modes Guide

Matra v0.8+ supports **syntax modes** to control which syntax style is allowed in your templates. This feature helps maintain consistency in large projects and provides better error detection.

## Overview

Matra offers three syntax modes:

| Mode              | Block Syntax | Function Syntax | Use Case                                  |
| ----------------- | ------------ | --------------- | ----------------------------------------- |
| `mixed` (default) | ✅           | ✅              | Maximum flexibility, backward compatible  |
| `document`        | ✅           | ❌              | HTML-heavy templates, Pug-style documents |
| `application`     | ❌           | ✅              | Component-driven apps, JSX-style code     |

## Usage

### Specifying the Mode

Pass the `mode` option to `compile()` or `matra()`:

```javascript
import { compile } from "@matra/core"

// Document mode: Only Pug-style syntax
const html = compile(
  `
  article.post {
    header {
      h1.title { "Blog Post" }
    }
  }
`,
  { mode: "document" }
)

// Application mode: Only JSX-style syntax
const component = compile(
  `
  article({class:"post"},
    header(
      h1({class:"title"}, "Blog Post")
    )
  )
`,
  { mode: "application" }
)

// Mixed mode (default): Both syntaxes allowed
const mixed = compile(`
  article.post {
    header(h1({class:"title"}, "Blog Post"))
  }
`) // mode: 'mixed' is default
```

## Mode Details

### Mixed Mode (Default)

**When to use:**

- During migration between syntax styles
- When team members have different preferences
- When you want maximum flexibility
- For backward compatibility with existing code

**Example:**

```javascript
compile(`
  nav.menu {
    ul(
      li(a({href:"/"}, "Home")),
      li(a({href:"/about"}, "About"))
    )
  }
`)
// ✅ Combines Block and Function syntax freely
```

### Document Mode

**When to use:**

- Building HTML-heavy templates
- Working with designers familiar with CSS
- Creating static sites or documentation
- When visual hierarchy with indentation matters

**Allowed:**

```javascript
compile(
  `
  div.container {
    h1#title { "Welcome" }
    p[class="intro"] { "Introduction text" }
  }
`,
  { mode: "document" }
)
// ✅ Pug-style syntax: .class, #id, [attr]
```

**Rejected:**

```javascript
compile(
  `
  div({class:"container"}, p("Hello"))
`,
  { mode: "document" }
)
// ❌ Error: Function syntax is not allowed in document mode
```

### Application Mode

**When to use:**

- Building component-based applications
- Working with React/JSX developers
- Need explicit property types (numbers, booleans)
- Programmatic template generation

**Allowed:**

```javascript
compile(
  `
  nav({class:"menu"},
    ul(
      li(a({href:"/"}, "Home")),
      li(a({href:"/about"}, "About"))
    )
  )
`,
  { mode: "application" }
)
// ✅ JSX-style syntax with explicit properties
```

**Rejected:**

```javascript
compile(
  `
  nav.menu {
    ul { li { a[href="/"] { "Home" } } }
  }
`,
  { mode: "application" }
)
// ❌ Error: Block syntax is not allowed in application mode
```

## Template Features

All modes support the full Matra feature set:

### Variable Interpolation

```javascript
// Document mode
compile('p { "Hello, {{name}}!" }', {
  mode: "document",
  context: { name: "World" },
})

// Application mode
compile('p("Hello, {{name}}!")', {
  mode: "application",
  context: { name: "World" },
})
```

### Directives (m-if, m-each)

```javascript
// Document mode
compile('div[m-if="show"] { "Content" }', {
  mode: "document",
  context: { show: true },
})

// Application mode
compile('div({"m-if":"show"}, "Content")', {
  mode: "application",
  context: { show: true },
})
```

## Use Cases

### Case 1: Static Site Generator (Document Mode)

```javascript
import { compile } from "@matra/core"

function renderBlogPost(post) {
  return compile(
    `
    article.blog-post {
      header.post-header {
        h1.post-title { "{{title}}" }
        time.post-date[datetime="{{date}}"] { "{{formattedDate}}" }
      }
      div.post-content {
        p[m-each="paragraphs" m-as="para"] { "{{para}}" }
      }
      footer.post-footer {
        a.read-more[href="{{url}}"] { "Read more →" }
      }
    }
  `,
    {
      mode: "document",
      context: post,
    }
  )
}
```

**Benefits:**

- Clean, CSS-like syntax
- Easy for designers to understand
- Enforces consistent Pug-style across the project

### Case 2: Component Library (Application Mode)

```javascript
import { compile } from "@matra/core"

function Button({ variant, onClick, children }) {
  return compile(
    `
    button({
      type: "button",
      class: "btn btn-{{variant}}",
      onclick: "{{onClick}}"
    }, "{{children}}")
  `,
    {
      mode: "application",
      context: { variant, onClick, children },
    }
  )
}

function Card({ title, description, link }) {
  return compile(
    `
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
  `,
    {
      mode: "application",
      context: { title, description, link },
    }
  )
}
```

**Benefits:**

- JSX-like syntax familiar to React developers
- Explicit property types (great with TypeScript)
- Prevents accidental use of Pug-style shortcuts

### Case 3: Flexible Framework (Mixed Mode)

```javascript
import { compile } from "@matra/core"

// Allow both syntaxes for maximum flexibility
function render(template, data) {
  return compile(template, {
    mode: "mixed", // or omit for default
    context: data,
  })
}

// Users can write either style
render('div.box { p("Hello") }', {}) // ✅ Works
render('div({class:"box"}, p("Hello"))', {}) // ✅ Also works
```

**Benefits:**

- Gradual migration between styles
- Team members can use their preferred syntax
- Maximum backward compatibility

## Migration Guide

### From v0.7 (Block-only) to v0.8+

Your existing code works without changes:

```javascript
// v0.7 code
compile('div.container { p { "Hello" } }')

// Still works in v0.8+ (uses default 'mixed' mode)
compile('div.container { p { "Hello" } }')

// Optionally enforce document mode
compile('div.container { p { "Hello" } }', { mode: "document" })
```

### Enforcing a Mode in Existing Projects

```javascript
// Wrap your compile function to enforce a mode
import { compile as matraCompile } from "@matra/core"

export function compile(source, opts = {}) {
  return matraCompile(source, {
    ...opts,
    mode: opts.mode || "document", // Default to document mode
  })
}
```

## Best Practices

### ✅ Do

- **Use `document` mode** for content-heavy sites and documentation
- **Use `application` mode** for component libraries and SPAs
- **Use `mixed` mode** during transition periods
- **Be consistent** within a single project

### ❌ Don't

- Mix modes randomly across files
- Change modes frequently without documentation
- Use `mixed` mode when you have a clear preference
- Force team members to use unfamiliar syntax

## Error Messages

When using the wrong syntax for a mode, you'll get clear error messages:

```text
// Document mode + Function syntax
SyntaxError: Function syntax is not allowed in document mode

// Application mode + Block syntax
SyntaxError: Block syntax is not allowed in application mode
```

## See Also

- [Function Syntax Guide](./function-syntax.md)
- [Syntax Comparison](./SYNTAX-COMPARISON.md)
- [Quick Reference](./QUICK-REFERENCE.md)
- [API Reference](./04-api-reference.md)
