# Directives

Matra provides powerful directives for conditional rendering and loops, available in two styles: tag-based and attribute-based.

## Conditional Rendering

### `m-if` Directive

Conditionally render elements based on a truthy value.

#### Attribute Style (v0.7+)

```javascript
import { compile } from '@matra/core'

const template = 'div[m-if="isActive"] { "Active" }'

compile(template, { context: { isActive: true } })
// Output: <div>Active</div>

compile(template, { context: { isActive: false } })
// Output: (empty)
```

#### Tag Style (v0.6+)

```javascript
const template = `
  m-if[test="isActive"] {
    div { "Active" }
  }
`

compile(template, { context: { isActive: true } })
// Output: <div>Active</div>
```

### `m-else` Directive

Provide alternative content when `m-if` is falsy.

#### With Attribute-Style `m-if`

```javascript
const template = `
  div {
    p[m-if="isLoggedIn"] { "Welcome back!" }
    m-else { p { "Please login" } }
  }
`

compile(template, { context: { isLoggedIn: false } })
// Output: <div><p>Please login</p></div>
```

#### With Tag-Style `m-if`

```javascript
const template = `
  m-if[test="isLoggedIn"] {
    nav.user-menu { "Menu" }
  }
  m-else {
    a.login-button { "Login" }
  }
`
```

#### `m-else` as Attribute

```javascript
const template = `
  div {
    p[m-if="hasItems"] { "Items available" }
    p[m-else] { "No items" }
  }
`
```

## Array Iteration

### `m-each` Directive

Iterate over arrays and render elements for each item.

#### Attribute Style (v0.7+)

```javascript
const template = `
  ul {
    li[m-each="items" m-as="item"] { "{{item}}" }
  }
`

compile(template, { 
  context: { items: ['Apple', 'Banana', 'Cherry'] } 
})
// Output:
// <ul>
//   <li>Apple</li>
//   <li>Banana</li>
//   <li>Cherry</li>
// </ul>
```

#### Tag Style (v0.6+)

```javascript
const template = `
  ul {
    m-each[of="items" as="item"] {
      li { "{{item}}" }
    }
  }
`
```

### Iteration with Objects

```javascript
const template = `
  div.products {
    div[m-each="products" m-as="product"] {
      h3 { "{{product.name}}" }
      p.price { "${{product.price}}" }
      p[m-if="product.inStock"] { "In Stock" }
      m-else { p { "Out of Stock" } }
    }
  }
`

compile(template, {
  context: {
    products: [
      { name: 'Apple', price: 1.2, inStock: true },
      { name: 'Banana', price: 0.8, inStock: false }
    ]
  }
})
```

### Index Variable

The `index` variable is automatically available in `m-each` loops:

```javascript
const template = `
  ol {
    li[m-each="items" m-as="item"] {
      "Item {{index}}: {{item}}"
    }
  }
`

compile(template, { context: { items: ['A', 'B', 'C'] } })
// Output:
// <ol>
//   <li>Item 0: A</li>
//   <li>Item 1: B</li>
//   <li>Item 2: C</li>
// </ol>
```

### Custom Index Name

Use `m-index` to specify a custom index variable name:

```javascript
const template = `
  ol {
    li[m-each="items" m-as="item" m-index="i"] {
      "{{i}}: {{item}}"
    }
  }
`
```

## Nested Directives

Directives can be nested for complex logic:

```javascript
const template = `
  section {
    m-if[test="categories.length"] {
      div[m-each="categories" m-as="cat"] {
        h2 { "{{cat.name}}" }
        ul[m-if="cat.items.length"] {
          li[m-each="cat.items" m-as="item"] {
            "{{item}}"
          }
        }
        m-else { p { "No items in this category" } }
      }
    }
    m-else {
      p { "No categories available" }
    }
  }
`
```

## Directive Priority

When both tag and attribute directives are present, **attribute directives have higher priority**:

1. Attribute-based `m-if`, `m-else`, `m-each`
2. Tag-based `m-if`, `m-else`, `m-each`
3. Regular element rendering

This ensures that attribute directives on the same element are processed before any nested tag directives.

## Best Practices

### Choose the Right Style

**Use attribute style when:**

- Wrapping a single element
- Condition is simple
- Template is more compact

```matra
div.notice[m-if="showNotice"] { "Important!" }
```

**Use tag style when:**

- Multiple elements depend on the condition
- Complex nested structure
- Logic is more prominent

```matra
m-if[test="isLoggedIn"] {
  nav.user-menu { ... }
  div.user-profile { ... }
}
```

### Avoid Deep Nesting

Instead of:

```matra
m-if[test="a"] {
  m-if[test="b"] {
    m-if[test="c"] {
      div { "Content" }
    }
  }
}
```

Use combined conditions in your context:

```javascript
const context = {
  showContent: a && b && c
}
```

```matra
div[m-if="showContent"] { "Content" }
```

### Name Variables Clearly

```matra
// Good
li[m-each="products" m-as="product"] { "{{product.name}}" }

// Avoid
li[m-each="products" m-as="p"] { "{{p.name}}" }
```

## Error Handling

### Missing Context Variables

If a variable referenced in a directive doesn't exist, it's treated as falsy:

```javascript
compile('div[m-if="nonexistent"] { "Text" }', { context: {} })
// Output: (empty)
```

### Non-Array in `m-each`

If the value passed to `m-each` is not an array, the loop is skipped:

```javascript
compile('li[m-each="items" m-as="item"] { "{{item}}" }', {
  context: { items: null }
})
// Output: (empty)
```

## Performance Considerations

- Directives are evaluated during the transform phase, not at render time
- Attribute directives are processed first (higher priority)
- Nested scopes are managed efficiently with a scope stack

Next: [API Reference](./04-api-reference.md)
