# Integration Guide

Learn how to integrate @matra/core into your project.

## Table of Contents

- [Installation](#installation)
- [Build Tools](#build-tools)
  - [Node.js](#nodejs)
  - [Vite](#vite)
  - [Webpack](#webpack)
  - [Rollup](#rollup)
- [Frameworks](#frameworks)
  - [Express.js](#expressjs)
  - [Fastify](#fastify)
  - [Koa](#koa)
- [Static Site Generators](#static-site-generators)
  - [Custom SSG](#custom-ssg)
  - [11ty (Eleventy)](#11ty-eleventy)
- [TypeScript](#typescript)
- [Best Practices](#best-practices)

## Installation

Install via npm:

```bash
npm install @matra/core
```

Or yarn:

```bash
yarn add @matra/core
```

Or pnpm:

```bash
pnpm add @matra/core
```

## Build Tools

### Node.js

Use Matra directly in Node.js scripts:

```javascript
import { compile } from '@matra/core';
import { writeFileSync } from 'fs';

const template = `
  html {
    head {
      title { "My Page" }
    }
    body {
      h1 { "Hello, \${name}!" }
    }
  }
`;

const render = compile(template);
const html = render({ name: 'World' });

writeFileSync('output.html', html);
```

### Vite

Create a Vite plugin for Matra templates:

**vite-plugin-matra.js:**

```javascript
import { compile } from '@matra/core';

export default function matraPlugin() {
  return {
    name: 'vite-plugin-matra',
    transform(code, id) {
      if (id.endsWith('.matra')) {
        const render = compile(code);
        return {
          code: `export default ${render.toString()}`,
          map: null
        };
      }
    }
  };
}
```

**vite.config.js:**

```javascript
import { defineConfig } from 'vite';
import matraPlugin from './vite-plugin-matra.js';

export default defineConfig({
  plugins: [matraPlugin()]
});
```

**Usage:**

```javascript
import template from './template.matra';

const html = template({ name: 'Alice' });
document.body.innerHTML = html;
```

### Webpack

Create a Webpack loader for Matra:

**matra-loader.js:**

```javascript
import { compile } from '@matra/core';

export default function matraLoader(source) {
  const render = compile(source);
  return `module.exports = ${render.toString()}`;
}
```

**webpack.config.js:**

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.matra$/,
        use: './matra-loader.js'
      }
    ]
  }
};
```

### Rollup

Use a Rollup plugin:

**rollup-plugin-matra.js:**

```javascript
import { compile } from '@matra/core';

export default function matra() {
  return {
    name: 'rollup-plugin-matra',
    transform(code, id) {
      if (id.endsWith('.matra')) {
        const render = compile(code);
        return {
          code: `export default ${render.toString()}`,
          map: null
        };
      }
    }
  };
}
```

**rollup.config.js:**

```javascript
import matra from './rollup-plugin-matra.js';

export default {
  input: 'src/main.js',
  output: { file: 'dist/bundle.js', format: 'esm' },
  plugins: [matra()]
};
```

## Frameworks

### Express.js

Use Matra as a view engine:

**app.js:**

```javascript
import express from 'express';
import { compile } from '@matra/core';
import { readFileSync } from 'fs';
import { join } from 'path';

const app = express();

// Custom Matra view engine
app.engine('matra', (filePath, options, callback) => {
  try {
    const template = readFileSync(filePath, 'utf-8');
    const render = compile(template);
    const html = render(options);
    callback(null, html);
  } catch (error) {
    callback(error);
  }
});

app.set('views', './views');
app.set('view engine', 'matra');

// Routes
app.get('/', (req, res) => {
  res.render('index', { title: 'Home', name: 'Alice' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

**views/index.matra:**

```matra
html {
  head {
    title { "${title}" }
  }
  body {
    h1 { "Hello, ${name}!" }
  }
}
```

### Fastify

Use Matra with Fastify's view plugin:

```javascript
import Fastify from 'fastify';
import view from '@fastify/view';
import { compile } from '@matra/core';

const fastify = Fastify();

fastify.register(view, {
  engine: {
    matra: {
      compile: (template) => {
        const render = compile(template);
        return (context) => render(context);
      }
    }
  },
  root: './views'
});

fastify.get('/', async (request, reply) => {
  return reply.view('index.matra', { title: 'Home', name: 'Bob' });
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) throw err;
  console.log('Server running on http://localhost:3000');
});
```

### Koa

Use Matra with Koa:

```javascript
import Koa from 'koa';
import { compile } from '@matra/core';
import { readFileSync } from 'fs';

const app = new Koa();

// Matra rendering middleware
app.use(async (ctx) => {
  if (ctx.path === '/') {
    const template = readFileSync('./views/index.matra', 'utf-8');
    const render = compile(template);
    ctx.body = render({ title: 'Home', name: 'Carol' });
    ctx.type = 'html';
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Static Site Generators

### Custom SSG

Build a simple static site generator:

**build.js:**

```javascript
import { compile } from '@matra/core';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const pagesDir = './pages';
const outDir = './dist';

// Ensure output directory exists
mkdirSync(outDir, { recursive: true });

// Read all .matra files from pages/
const files = readdirSync(pagesDir).filter(f => f.endsWith('.matra'));

files.forEach(file => {
  const template = readFileSync(join(pagesDir, file), 'utf-8');
  const render = compile(template);
  
  // Example context (could be loaded from JSON/YAML)
  const context = {
    title: file.replace('.matra', ''),
    siteName: 'My Site'
  };
  
  const html = render(context);
  const outFile = file.replace('.matra', '.html');
  
  writeFileSync(join(outDir, outFile), html);
  console.log(`✅ Generated ${outFile}`);
});

console.log(`\n🎉 Built ${files.length} pages`);
```

**Run:**

```bash
node build.js
```

### 11ty (Eleventy)

Create an 11ty template engine:

**.eleventy.js:**

```javascript
import { compile } from '@matra/core';

export default function(eleventyConfig) {
  // Add Matra template engine
  eleventyConfig.addTemplateFormats('matra');
  
  eleventyConfig.addExtension('matra', {
    compile: (inputContent) => {
      const render = compile(inputContent);
      return (data) => render(data);
    }
  });
  
  return {
    dir: {
      input: 'src',
      output: 'dist'
    }
  };
}
```

**src/index.matra:**

```matra
html {
  head {
    title { "${title}" }
  }
  body {
    h1 { "Welcome to ${siteName}" }
    main {
      "${content}"
    }
  }
}
```

## TypeScript

Use Matra with TypeScript:

**types.d.ts:**

```typescript
declare module '@matra/core' {
  export interface MatraNode {
    type: 'element' | 'text';
    tagName?: string;
    properties?: Record<string, any>;
    children?: MatraNode[];
    value?: string;
  }

  export interface MatraSyntaxTree {
    type: 'root';
    children: MatraNode[];
  }

  export function parse(template: string): MatraSyntaxTree;
  export function compile(
    template: string,
    options?: { context?: Record<string, any> }
  ): (context: Record<string, any>) => string;
  export function transform(
    ast: MatraSyntaxTree,
    context: Record<string, any>
  ): MatraNode;
  export function with_(
    context: Record<string, any>
  ): (template: string | TemplateStringsArray) => string;
  export function toHTML(tree: MatraNode): string;
  export function toJSON(tree: MatraNode): string;
}
```

**app.ts:**

```typescript
import { compile, with_ } from '@matra/core';

interface PageContext {
  title: string;
  name: string;
  items: string[];
}

const template = `
  html {
    head {
      title { "\${title}" }
    }
    body {
      h1 { "Hello, \${name}!" }
      ul {
        li[m-each="\${items}" m-each:item="item"] {
          "\${item}"
        }
      }
    }
  }
`;

const render = compile(template);

const context: PageContext = {
  title: 'My Page',
  name: 'Alice',
  items: ['Item 1', 'Item 2', 'Item 3']
};

const html = render(context);
console.log(html);
```

## Best Practices

### 1. Pre-compile Templates

Compile templates once during build time:

```javascript
// ❌ Bad: Compile on every request
app.get('/', (req, res) => {
  const template = readFileSync('./template.matra', 'utf-8');
  const render = compile(template); // Slow!
  res.send(render({ name: 'Alice' }));
});

// ✅ Good: Compile once at startup
const render = compile(readFileSync('./template.matra', 'utf-8'));

app.get('/', (req, res) => {
  res.send(render({ name: 'Alice' }));
});
```

### 2. Cache Compiled Templates

Use a Map for caching:

```javascript
const templateCache = new Map();

function getTemplate(path) {
  if (!templateCache.has(path)) {
    const template = readFileSync(path, 'utf-8');
    templateCache.set(path, compile(template));
  }
  return templateCache.get(path);
}

app.get('/', (req, res) => {
  const render = getTemplate('./template.matra');
  res.send(render({ name: 'Alice' }));
});
```

### 3. Separate Layout and Content

Use nested templates:

**layout.matra:**

```matra
html {
  head {
    title { "${title}" }
  }
  body {
    header {
      nav { "${renderNav()}" }
    }
    main {
      "${content}"
    }
    footer {
      p { "© 2025 My Site" }
    }
  }
}
```

**page.matra:**

```matra
div[class="content"] {
  h1 { "${heading}" }
  p { "${body}" }
}
```

**app.js:**

```javascript
const layoutRender = compile(readFileSync('./layout.matra', 'utf-8'));
const pageRender = compile(readFileSync('./page.matra', 'utf-8'));

app.get('/', (req, res) => {
  const content = pageRender({ heading: 'Home', body: 'Welcome!' });
  const html = layoutRender({
    title: 'Home',
    content,
    renderNav: () => '<a href="/">Home</a>'
  });
  res.send(html);
});
```

### 4. Use Context Helpers

Create reusable helper functions:

```javascript
const helpers = {
  formatDate: (date) => new Date(date).toLocaleDateString(),
  capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
  pluralize: (count, singular, plural) => count === 1 ? singular : plural
};

const render = compile(template);

app.get('/', (req, res) => {
  res.send(render({ ...helpers, name: 'Alice', date: Date.now() }));
});
```

### 5. Handle Errors Gracefully

Wrap rendering in try-catch:

```javascript
app.get('/', (req, res) => {
  try {
    const html = render({ name: 'Alice' });
    res.send(html);
  } catch (error) {
    console.error('Render error:', error);
    res.status(500).send('Error rendering page');
  }
});
```

## Next Steps

- **[Examples](./06-examples.md)**: See complete integration examples
- **[API Reference](./04-api-reference.md)**: Explore the full API
- **[Directives](./03-directives.md)**: Learn about control flow

---

For more information, see the [main README](../README.md).
