# API Reference

Complete API documentation for @matra/core.

## Table of Contents

- [Core Functions](#core-functions)
  - [parse()](#parse)
  - [compile()](#compile)
  - [transform()](#transform)
  - [with_()](#with_)
  - [toHTML()](#tohtml)
  - [toJSON()](#tojson)
- [Types](#types)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)

## Core Functions

### parse()

Parses a Matra template string into an Abstract Syntax Tree (AST).

```javascript
import { parse } from '@matra/core';

const ast = parse(template);
```

#### Parameters

- **`template`** (string): The Matra template source code

#### Returns

- **MatraSyntaxTree**: The parsed AST representing the template structure

#### Example

```javascript
const template = `
  div[class="container"] {
    h1 { "Hello, World!" }
  }
`;

const ast = parse(template);
console.log(JSON.stringify(ast, null, 2));
```

#### Errors

Throws a **SyntaxError** if the template contains invalid syntax:

```javascript
try {
  parse('div[class=unclosed');
} catch (error) {
  console.error('Parse error:', error.message);
}
```

---

### compile()

Compiles a Matra template into a function that can be called with context data.

```javascript
import { compile } from '@matra/core';

const renderFn = compile(template, options);
const html = renderFn(context);
```

#### Parameters

- **`template`** (string): The Matra template source code
- **`options`** (object, optional): Compilation options
  - **`context`** (object): Pre-bind context variables

#### Returns

- **Function**: A render function that accepts a context object and returns HTML

#### Example

```javascript
const template = `
  div {
    h1 { "Hello, \${name}!" }
    p { "You have \${count} messages." }
  }
`;

const render = compile(template);

const html = render({ name: 'Alice', count: 5 });
console.log(html);
// <div><h1>Hello, Alice!</h1><p>You have 5 messages.</p></div>
```

#### Pre-bound Context

Use the `context` option to pre-bind variables:

```javascript
const render = compile(template, {
  context: { siteName: 'My Site' }
});

// siteName is always available
const html = render({ name: 'Alice' });
```

---

### transform()

Transforms a parsed AST into a HAST (Hypertext Abstract Syntax Tree) by evaluating directives and interpolations.

```javascript
import { parse, transform } from '@matra/core';

const ast = parse(template);
const hast = transform(ast, context);
```

#### Parameters

- **`ast`** (MatraSyntaxTree): The parsed AST from `parse()`
- **`context`** (object): The data context for interpolations and directives

#### Returns

- **HAST Node**: A HAST tree representing the rendered HTML structure

#### Example

```javascript
const template = `
  ul {
    li[m-each="\${items}" m-each:item="item"] {
      "\${item}"
    }
  }
`;

const ast = parse(template);
const hast = transform(ast, { items: ['Apple', 'Banana', 'Cherry'] });

console.log(JSON.stringify(hast, null, 2));
```

---

### with_()

Creates a curried render function with pre-bound context.

```javascript
import { with_ } from '@matra/core';

const render = with_(context);
const html = render(template);
```

#### Parameters

- **`context`** (object): The data context to bind

#### Returns

- **Function**: A function that accepts a template (string or tagged template literal) and returns HTML

#### Example (String Template)

```javascript
const render = with_({ name: 'Alice', count: 5 });

const html = render(`
  div {
    h1 { "Hello, \${name}!" }
    p { "You have \${count} messages." }
  }
`);

console.log(html);
```

#### Example (Tagged Template Literal)

```javascript
const render = with_({ name: 'Alice' });

const html = render`
  div {
    h1 { "Hello, \${name}!" }
  }
`;

console.log(html);
```

**Note:** Tagged template literals are supported as of v0.7.0.

---

### toHTML()

Converts a HAST or Matrast tree into an HTML string.

```javascript
import { parse, transform, toHTML } from '@matra/core';

const ast = parse(template);
const hast = transform(ast, context);
const html = toHTML(hast);
```

#### Parameters

- **`tree`** (HAST Node | Matrast Node): The tree to render

#### Returns

- **string**: The rendered HTML string

#### Example

```javascript
const template = `div { "Hello" }`;
const ast = parse(template);
const hast = transform(ast, {});
const html = toHTML(hast);

console.log(html); // <div>Hello</div>
```

#### Rendering Formats

`toHTML()` automatically detects the node type:

- **HAST nodes** (from `transform()`) are rendered using `renderHastNode()`
- **Matrast nodes** (from `parse()`) are rendered using `renderMatrastNode()`

---

### toJSON()

Converts a HAST tree into a JSON string.

```javascript
import { parse, transform, toJSON } from '@matra/core';

const ast = parse(template);
const hast = transform(ast, context);
const json = toJSON(hast);
```

#### Parameters

- **`tree`** (HAST Node): The tree to serialize

#### Returns

- **string**: A JSON representation of the tree

#### Example

```javascript
const template = `div { "Hello" }`;
const ast = parse(template);
const hast = transform(ast, {});
const json = toJSON(hast);

console.log(json);
// {"type":"element","tagName":"div","properties":{},"children":[{"type":"text","value":"Hello"}]}
```

## Types

### MatraSyntaxTree

The AST structure returned by `parse()`.

```typescript
interface MatraSyntaxTree {
  type: 'root';
  children: MatraNode[];
}

interface MatraNode {
  type: 'element' | 'text';
  tagName?: string;
  properties?: Record<string, string | boolean>;
  children?: MatraNode[];
  value?: string;
}
```

### HAST Node

Standard HAST (Hypertext Abstract Syntax Tree) format.

```typescript
interface HastNode {
  type: 'root' | 'element' | 'text';
  tagName?: string;
  properties?: Record<string, any>;
  children?: HastNode[];
  value?: string;
}
```

## Error Handling

### Parse Errors

`parse()` throws a **SyntaxError** for invalid templates:

```javascript
try {
  parse('div[class=');
} catch (error) {
  console.error('Syntax error:', error.message);
  console.error('Location:', error.location);
}
```

### Transform Errors

`transform()` throws errors for:

- **Undefined variables** in interpolations
- **Invalid directive syntax**

```javascript
try {
  const ast = parse('div { "${undefined_var}" }');
  transform(ast, {});
} catch (error) {
  console.error('Transform error:', error.message);
}
```

### Runtime Safety

Use optional chaining and default values:

```javascript
const template = `div { "\${user?.name ?? 'Guest'}" }`;
const render = compile(template);

const html = render({}); // Safely handles missing user
console.log(html); // <div>Guest</div>
```

## Advanced Usage

### Custom Context Functions

Pass functions in the context:

```javascript
const render = with_({
  users: [{ name: 'Alice' }, { name: 'Bob' }],
  formatName: (name) => name.toUpperCase()
});

const html = render`
  ul {
    li[m-each="\${users}" m-each:item="user"] {
      "\${formatName(user.name)}"
    }
  }
`;

console.log(html);
// <ul><li>ALICE</li><li>BOB</li></ul>
```

### Nested Templates

Compile sub-templates and use them in the main template:

```javascript
const cardTemplate = compile(`
  div[class="card"] {
    h3 { "\${title}" }
    p { "\${description}" }
  }
`);

const context = {
  items: [
    { title: 'Item 1', description: 'First item' },
    { title: 'Item 2', description: 'Second item' }
  ],
  renderCard: cardTemplate
};

const mainTemplate = `
  div[class="grid"] {
    m-each[of="\${items}" item="item"] {
      "\${renderCard(item)}"
    }
  }
`;

const html = compile(mainTemplate)(context);
```

### Incremental Rendering

Use `transform()` and `toHTML()` separately for control:

```javascript
const ast = parse(template); // Parse once

// Render multiple times with different contexts
const html1 = toHTML(transform(ast, { name: 'Alice' }));
const html2 = toHTML(transform(ast, { name: 'Bob' }));
```

### Streaming (Future)

Currently not supported, but planned for future versions:

```javascript
// Future API (not yet implemented)
const stream = compileStream(template);
stream.write({ name: 'Alice' });
stream.write({ name: 'Bob' });
stream.end();
```

## Performance Tips

### 1. Pre-compile Templates

Compile templates once, reuse the render function:

```javascript
// ❌ Bad: Compiles on every render
function renderPage(data) {
  return compile(template)(data);
}

// ✅ Good: Compile once
const render = compile(template);
function renderPage(data) {
  return render(data);
}
```

### 2. Use parse() + transform() for Caching

Cache the parsed AST:

```javascript
const astCache = new Map();

function render(template, context) {
  if (!astCache.has(template)) {
    astCache.set(template, parse(template));
  }
  const ast = astCache.get(template);
  return toHTML(transform(ast, context));
}
```

### 3. Minimize Directive Nesting

Deeply nested directives are slower:

```javascript
// ❌ Slower
m-if[test="\${a}"] {
  m-if[test="\${b}"] {
    m-if[test="\${c}"] {
      div { "Content" }
    }
  }
}

// ✅ Faster
m-if[test="\${a && b && c}"] {
  div { "Content" }
}
```

## Next Steps

- **[Directives](./03-directives.md)**: Learn about control flow directives
- **[Integration Guide](./05-integration.md)**: Integrate Matra into your project
- **[Examples](./06-examples.md)**: See real-world usage examples

---

For more information, see the [main README](../README.md).
