# Matra Documentation

Welcome to the @matra/core documentation!

## Table of Contents

1. **[Introduction](./01-introduction.md)** ✅
   - What is Matra?
   - Design philosophy
   - Use cases and comparison with other template engines

2. **[Syntax Overview](./02-syntax-overview.md)** ✅
   - Basic structure
   - Elements and attributes
   - Text content and interpolation
   - Comments and whitespace handling

3. **[Directives](./03-directives.md)** ✅
   - Conditional rendering (`m-if`, `m-else`)
   - Array iteration (`m-each`)
   - Directive styles (tag-based vs attribute-based)
   - Best practices

4. **[API Reference](./04-api-reference.md)** ✅
   - Core functions: `parse()`, `compile()`, `transform()`, `with_()`, `toHTML()`, `toJSON()`
   - Types and interfaces
   - Error handling
   - Advanced usage

5. **[Integration Guide](./05-integration.md)** ✅
   - Build tool integration (Vite, Webpack, Rollup)
   - Framework integration (Express, Fastify, Koa)
   - Static site generators
   - TypeScript setup

6. **[Examples](./06-examples.md)** ✅
   - Blog post card
   - Navigation menu
   - User profile
   - Product grid
   - Form with validation
   - Data table
   - Comment thread
   - Dashboard widget

## Quick Links

- [Main README](../README.md)
- [CHANGELOG](../CHANGELOG.md)
- [GitHub Repository](https://github.com/matralang/matra-core)
- [npm Package](https://www.npmjs.com/package/@matra/core)

## Quick Start

Install:

```bash
npm install @matra/core
```

Basic usage:

```javascript
import { compile } from '@matra/core';

const template = `
  div {
    h1 { "Hello, \${name}!" }
  }
`;

const render = compile(template);
console.log(render({ name: 'World' }));
// <div><h1>Hello, World!</h1></div>
```

## Documentation Status

All documentation is now complete! 🎉

- ✅ Introduction
- ✅ Syntax Overview
- ✅ Directives
- ✅ API Reference
- ✅ Integration Guide
- ✅ Examples

## Contributing

Contributions are welcome! Please see the main [README](../README.md) for contribution guidelines.

## License

MIT © butchi

---

**Ready to get started?** Begin with the [Introduction](./01-introduction.md)!
