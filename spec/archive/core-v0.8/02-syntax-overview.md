# Syntax Overview

[English](./02-syntax-overview.md) | [日本語](./02-syntax-overview.ja.md)

This document provides a comprehensive overview of Matra's syntax, covering elements, attributes, text content, and special constructs.

## Table of Contents

- [Basic Structure](#basic-structure)
- [Elements](#elements)
- [Attributes](#attributes)
- [Text Content](#text-content)
- [Directives](#directives)
- [Comments](#comments)
- [Whitespace Handling](#whitespace-handling)
- [Escaping](#escaping)

## Basic Structure

Matra templates are composed of **elements** (tags) with **attributes** and **text content**. The syntax is designed to be familiar to anyone who knows HTML.

```matra
article[class="post"] {
  h1 { "Hello, World!" }
  p { "This is a paragraph." }
}
```

**Output:**

```html
<article class="post">
  <h1>Hello, World!</h1>
  <p>This is a paragraph.</p>
</article>
```

## Elements

### Basic Element Syntax

```matra
tagname[attributes] { children }
```

- **`tagname`**: The HTML tag name (e.g., `div`, `span`, `article`)
- **`[attributes]`**: Optional attribute list in square brackets
- **`{ children }`**: Element content in curly braces

### Self-Closing Elements

Elements without children can omit the braces:

```matra
img[src="photo.jpg" alt="A photo"]
br
hr
```

### Nested Elements

Elements can be nested indefinitely:

```matra
nav {
  ul {
    li { a[href="/"] { "Home" } }
    li { a[href="/about"] { "About" } }
  }
}
```

## Attributes

### Basic Attribute Syntax

Attributes are specified in square brackets after the tag name:

```matra
a[href="/page" class="link" target="_blank"] { "Click me" }
```

### Attribute Values

#### String Values (Quoted)

```matra
div[id="main" class="container"]
```

#### Boolean Attributes

Attributes without values are treated as boolean:

```matra
input[type="checkbox" checked disabled]
```

**Output:**

```html
<input type="checkbox" checked disabled>
```

#### Expression Values

Use JavaScript expressions in attribute values:

```matra
div[data-count="${count}" style="width: ${width}px"]
```

### Dynamic Attributes

Attributes can reference variables from the context:

```matra
a[href="${url}" class="${active ? 'active' : ''}"] { "${label}" }
```

With context:

```js
{ url: "/home", active: true, label: "Home" }
```

**Output:**

```html
<a href="/home" class="active">Home</a>
```

## Text Content

### Plain Text

Text content is enclosed in quotes:

```matra
p { "This is plain text." }
```

### Interpolated Text

Use `${}` for variable interpolation:

```matra
p { "Hello, ${name}!" }
```

With context `{ name: "Alice" }`:

**Output:**

```html
<p>Hello, Alice!</p>
```

### Multiple Text Nodes

Multiple strings create multiple text nodes:

```matra
p {
  "First line. "
  "Second line."
}
```

### Mixed Content

Mix text and elements:

```matra
p {
  "Visit our "
  a[href="/site"] { "website" }
  " for more info."
}
```

## Directives

Directives are special attributes that control rendering logic. See [Directives](./03-directives.md) for detailed documentation.

### Attribute-Based Directives

```matra
div[m-if="${showContent}"] {
  p { "This is conditional content." }
}

ul {
  li[m-each="${items}" m-each:item="item"] {
    "${item.name}"
  }
}
```

### Tag-Based Directives

```matra
m-if[test="${showContent}"] {
  div {
    p { "This is conditional content." }
  }
}

m-each[of="${items}" item="item"] {
  li { "${item.name}" }
}
```

## Comments

### Single-Line Comments

Comments start with `//` and extend to the end of the line:

```matra
div {
  // This is a comment
  p { "Content" }
}
```

### Multi-Line Comments

Multi-line comments use `/* */`:

```matra
div {
  /*
   * This is a multi-line comment
   * spanning multiple lines
   */
  p { "Content" }
}
```

**Note:** Comments are removed during parsing and do not appear in the output.

## Whitespace Handling

### Insignificant Whitespace

Whitespace between elements is generally insignificant:

```matra
// These are equivalent:
div { p { "Text" } }

div {
  p {
    "Text"
  }
}
```

### Significant Whitespace

Whitespace **inside text content** is preserved:

```matra
p { "  Spaces at the start and end are preserved.  " }
```

**Output:**

```html
<p>  Spaces at the start and end are preserved.  </p>
```

### Controlling Whitespace

Use empty strings or explicit spaces to control spacing:

```matra
p {
  "First"
  " "  // Explicit space
  "Second"
}
```

## Escaping

### Escaping Quotes

Use backslash to escape quotes in strings:

```matra
p { "She said, \"Hello!\"" }
```

**Output:**

```html
<p>She said, "Hello!"</p>
```

### Escaping Interpolation

To output literal `${}`, escape the dollar sign:

```matra
p { "The syntax is \${variable}" }
```

**Output:**

```html
<p>The syntax is ${variable}</p>
```

### HTML Entities

HTML entities are **not** automatically escaped. Use the `escape()` function if needed:

```matra
p { "${escape(userInput)}" }
```

## Complete Example

Here's a comprehensive example demonstrating various syntax features:

```matra
article[class="blog-post" data-id="${post.id}"] {
  // Post header
  header {
    h1 { "${post.title}" }
    p[class="meta"] {
      "Published on "
      time[datetime="${post.date}"] { "${formatDate(post.date)}" }
      " by "
      a[href="${post.author.url}"] { "${post.author.name}" }
    }
  }

  // Post body
  div[class="content"] {
    /* Main content goes here */
    m-each[of="${post.paragraphs}" item="para"] {
      p { "${para}" }
    }
  }

  // Comments section (conditional)
  m-if[test="${post.commentsEnabled}"] {
    section[class="comments"] {
      h2 { "Comments" }
      ul {
        m-each[of="${post.comments}" item="comment"] {
          li[class="comment"] {
            strong { "${comment.author}" }
            ": "
            "${comment.text}"
          }
        }
      }
    }
  }
}
```

With context:

```js
{
  post: {
    id: 123,
    title: "Getting Started with Matra",
    date: "2025-01-15",
    author: { name: "Alice", url: "/authors/alice" },
    paragraphs: ["First paragraph.", "Second paragraph."],
    commentsEnabled: true,
    comments: [
      { author: "Bob", text: "Great post!" },
      { author: "Carol", text: "Thanks for sharing." }
    ]
  },
  formatDate: (date) => new Date(date).toLocaleDateString()
}
```

## Next Steps

- **[Directives](./03-directives.md)**: Learn about conditional rendering and loops
- **[API Reference](./04-api-reference.md)**: Explore the JavaScript API
- **[Integration Guide](./05-integration.md)**: Integrate Matra into your project

---

For more examples, see the [Examples](./06-examples.md) document.
