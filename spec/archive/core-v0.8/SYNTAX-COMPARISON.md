# Matra Syntax Comparison: Block vs Function

[English](./SYNTAX-COMPARISON.md) | [日本語](./SYNTAX-COMPARISON.ja.md)

## Side-by-Side Examples

### Simple Element with Text

| Block Syntax (v0.7) | Function Syntax (v0.8) | HTML Output    |
| ------------------- | ---------------------- | -------------- |
| `p { "Hello" }`     | `p("Hello")`           | `<p>Hello</p>` |

### Element with Class

| Block Syntax                  | Function Syntax                       | HTML Output                            |
| ----------------------------- | ------------------------------------- | -------------------------------------- |
| `div.container { "Content" }` | `div({class:"container"}, "Content")` | `<div class="container">Content</div>` |

### Element with ID

| Block Syntax          | Function Syntax            | HTML Output                |
| --------------------- | -------------------------- | -------------------------- |
| `h1#main { "Title" }` | `h1({id:"main"}, "Title")` | `<h1 id="main">Title</h1>` |

### Multiple Properties

| Block Syntax                                      | Function Syntax                                            | HTML Output                                             |
| ------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `a.link[href="/home" target="_blank"] { "Link" }` | `a({href:"/home", class:"link", target:"_blank"}, "Link")` | `<a href="/home" class="link" target="_blank">Link</a>` |

### Nested Elements

| Block Syntax           | Function Syntax  | HTML Output              |
| ---------------------- | ---------------- | ------------------------ |
| `div { p { "Text" } }` | `div(p("Text"))` | `<div><p>Text</p></div>` |

### Multiple Children

| Block Syntax                  | Function Syntax       | HTML Output                   |
| ----------------------------- | --------------------- | ----------------------------- |
| `div { p { "A" } p { "B" } }` | `div(p("A"), p("B"))` | `<div><p>A</p><p>B</p></div>` |

### Complex Nesting

**Block Syntax:**

```matra
div.container {
  h1#title { "Welcome" }
  p { "Description" }
}
```

**Function Syntax:**

```matra
div({class:"container"},
  h1({id:"title"}, "Welcome"),
  p("Description")
)
```

**Output:**

```html
<div class="container">
  <h1 id="title">Welcome</h1>
  <p>Description</p>
</div>
```

## Real-World Examples

### Navigation Menu

**Block Syntax:**

```matra
nav.menu {
  ul {
    li { a[href="/"] { "Home" } }
    li { a[href="/about"] { "About" } }
    li { a[href="/contact"] { "Contact" } }
  }
}
```

**Function Syntax:**

```matra
nav({class:"menu"},
  ul(
    li(a({href:"/"}, "Home")),
    li(a({href:"/about"}, "About")),
    li(a({href:"/contact"}, "Contact"))
  )
)
```

**Output:**

```html
<nav class="menu">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>
```

### Card Component

**Block Syntax:**

```matra
article.card {
  header.card-header {
    h2.card-title { "{{title}}" }
  }
  div.card-body {
    p { "{{description}}" }
  }
  footer.card-footer {
    a.btn[href="{{link}}"] { "Read More" }
  }
}
```

**Function Syntax:**

```matra
article({class:"card"},
  header({class:"card-header"},
    h2({class:"card-title"}, "{{title}}")
  ),
  div({class:"card-body"},
    p("{{description}}")
  ),
  footer({class:"card-footer"},
    a({href:"{{link}}", class:"btn"}, "Read More")
  )
)
```

### Form

**Block Syntax:**

```matra
form[action="/login" method="post"] {
  div.form-group {
    label[for="email"] { "Email:" }
    input[type="email" id="email" required]
  }
  div.form-group {
    label[for="password"] { "Password:" }
    input[type="password" id="password" required]
  }
  button.btn[type="submit"] { "Login" }
}
```

**Function Syntax:**

```matra
form({action:"/login", method:"post"},
  div({class:"form-group"},
    label({for:"email"}, "Email:"),
    input({type:"email", id:"email", required:true})
  ),
  div({class:"form-group"},
    label({for:"password"}, "Password:"),
    input({type:"password", id:"password", required:true})
  ),
  button({type:"submit", class:"btn"}, "Login")
)
```

## Template Features Comparison

### Variable Interpolation

| Block Syntax               | Function Syntax         |
| -------------------------- | ----------------------- |
| `p { "Hello, {{name}}!" }` | `p("Hello, {{name}}!")` |

Both produce: `<p>Hello, Butchi!</p>` (when `name="Butchi"`)

### Conditional Rendering (m-if)

| Block Syntax                     | Function Syntax                   |
| -------------------------------- | --------------------------------- |
| `div[m-if="show"] { "Content" }` | `div({"m-if":"show"}, "Content")` |

Both produce: `<div>Content</div>` (when `show=true`) or empty (when `show=false`)

### Array Iteration (m-each)

| Block Syntax                                           | Function Syntax                                         |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `ul { li[m-each="items" m-as="item"] { "{{item}}" } }` | `ul(li({"m-each":"items", "m-as":"item"}, "{{item}}"))` |

Both produce: `<ul><li>A</li><li>B</li><li>C</li></ul>` (when `items=["A","B","C"]`)

## Advantages of Each Syntax

### Block Syntax Advantages

✅ **CSS-like selectors** - `.class` and `#id` shorthand  
✅ **Visual hierarchy** - Indentation shows structure  
✅ **Concise attributes** - `[href="/"]` vs `{href:"/"}`  
✅ **Familiar to CSS users** - Similar to SCSS/LESS  
✅ **Great for documents** - HTML-like structure

**Best for:**

- HTML-heavy templates
- Document-oriented content
- Developers familiar with CSS
- When visual hierarchy matters

### Function Syntax Advantages

✅ **JSX-like** - Familiar to React developers  
✅ **Programmatic** - Natural for JS composition  
✅ **Inline-friendly** - Compact one-liners  
✅ **Explicit properties** - Clear key-value pairs  
✅ **Type-safe values** - Numbers and booleans

**Best for:**

- Component-based architecture
- Programmatic generation
- JavaScript-heavy applications
- React/JSX developers
- API/data-driven templates

## Which Should I Use?

### Use Block Syntax When

- Building HTML-like templates
- Working with CSS-heavy layouts
- Prefer visual indentation
- Writing document templates
- Team familiar with CSS/SCSS

### Use Function Syntax When

- Building component libraries
- Generating templates programmatically
- Coming from React/JSX background
- Need explicit type control
- Building data-driven UIs

### Mix Both When

- Different parts suit different syntaxes
- Transitioning between styles
- Team has mixed preferences
- Want flexibility

## Key Takeaway

**Both syntaxes produce identical HAST nodes and HTML output.**  
Choose based on readability, team familiarity, and use case.  
You can mix both in the same project!

---

See also:

- [Function Syntax Guide](function-syntax.md)
- [Quick Reference](QUICK-REFERENCE.md)
- [Examples](./examples/function-syntax-demo.mjs)
