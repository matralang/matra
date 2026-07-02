# Matra v0.8 Implementation Summary

## Overview

Successfully implemented function-style syntax for Matra v0.8 while maintaining full backward compatibility with v0.7 block-style syntax.

## Changes Made

### 1. Grammar Extension (`src/matra-parser.pegjs`)

Added the following rules to support function syntax:

- **`TagApply`**: Main rule for function-style element creation

  ```peggy
  TagApply = tag:Identifier _ "(" _ args:ArgList? _ ")"
  ```

  - Parses `tagName(args)` syntax
  - First object argument → properties
  - Remaining arguments → children
  - Returns HAST-compatible nodes

- **`ArgList`**: Comma-separated argument parsing

  ```peggy
  ArgList = head:Arg tail:(_ "," _ Arg)*
  ```

- **`Arg`**: Individual argument types

  - `BareObject`: Properties object `{key:"value"}`
  - `TagApply`: Nested function calls
  - `StringLiteral`: Text content
  - `Number`: Numeric values
  - `Boolean`: `true`/`false`
  - `Identifier`: Plain identifiers

- **`BareObject`**: Property object parsing

  ```peggy
  BareObject = "{" _ pairs:(BarePair (_ "," _ BarePair)*)? _ "}"
  ```

  - Returns `{ __kind:"bare-object", value:{...} }`
  - Distinguished from element blocks

- **`BarePair`**: Key-value pairs in objects

  - Supports string and identifier keys
  - Values can be strings, numbers, booleans, or identifiers

- **`Identifier`**: Valid tag/property names

  ```peggy
  Identifier = !ReservedWord first:[a-zA-Z_] rest:[a-zA-Z0-9_\-]*
  ```

- **`Number`**: Numeric literals

  ```peggy
  Number = digits:[0-9]+ ("." [0-9]+)?
  ```

- **`Boolean`**: Boolean literals

  ```peggy
  Boolean = "true" / "false"
  ```

- **`ReservedWord`**: Reserved keywords
  - Prevents `true`/`false` from being parsed as identifiers

### 2. Parser Integration

- Added `TagApply` as first alternative in `Block` rule
- Ensures function syntax has priority in parsing
- Maintains all existing rules for backward compatibility

### 3. Test Suite

Created comprehensive test files:

#### `tests/function-syntax.test.mjs` (10 tests)

- Simple function calls
- Properties handling
- Nested structures
- Number/boolean properties
- Complex real-world examples

#### `tests/v07-compat.test.mjs` (11 tests)

- Verifies all v0.7 features still work
- Block syntax with classes/IDs
- Attributes
- Directives (m-if, m-each)
- Template interpolation
- HTML elements
- Comments

#### `tests/mixed-syntax.test.mjs` (9 tests)

- Both syntaxes in same codebase
- Equivalence verification
- Template integration
- Complex nested structures

### 4. Documentation

#### `docs/function-syntax.md`

- Complete syntax guide
- Quick reference
- Examples for all features
- Integration with template system
- When to use which syntax
- Migration guide (no migration needed!)

#### `examples/function-syntax-demo.mjs`

- 11 practical examples
- Side-by-side comparisons
- Template variable usage
- Directive examples
- Real-world patterns (nav, cards, forms)

## Test Results

All tests passing:

- ✅ 10/10 function syntax tests
- ✅ 11/11 v0.7 compatibility tests
- ✅ 9/9 mixed syntax tests
- **Total: 30/30 passing**

## Examples

### Simple

```matra
p("Hello, World!")
→ <p>Hello, World!</p>
```

### With Properties

```matra
h1({class:"title", id:"main"}, "Welcome")
→ <h1 class="title" id="main">Welcome</h1>
```

### Nested

```matra
div(h1("Title"), p("Content"))
→ <div><h1>Title</h1><p>Content</p></div>
```

### Equivalent to Block Syntax

```matra
// Block syntax
div.container { h1#title { "Hello" } }

// Function syntax
div({class:"container"}, h1({id:"title"}, "Hello"))

// Both produce:
<div class="container"><h1 id="title">Hello</h1></div>
```

## Integration with Existing Features

### ✅ Template Variables (Mustache)

```javascript
compile('p("{{name}}")', { context: { name: "Butchi" } })
→ <p>Butchi</p>
```

### ✅ Directives (m-if, m-each)

```javascript
compile('p({"m-if":"show"}, "Text")', { context: { show: true } })
→ <p>Text</p>
```

### ✅ HAST Output

Both syntaxes produce identical HAST nodes:

```javascript
{
  type: "element",
  tagName: "p",
  properties: {},
  children: [{ type: "text", value: "Hello" }]
}
```

## Backward Compatibility

- ✅ All v0.7 syntax remains functional
- ✅ No breaking changes
- ✅ Existing templates work without modification
- ✅ `evaluate.mjs` and `transform.mjs` unchanged
- ✅ All renderers (HTML, JSON, etc.) work with both syntaxes

## Grammar Summary

```peggy
Block
  = TagApply          // NEW: Function syntax
  / TagBody           // Existing: Block syntax with {}
  / Tag               // Existing: Simple tags
  / SetRule           // Existing: Attributes
  / HtmlElement       // Existing: Raw HTML
  / StringNode        // Existing: String literals
  / CommentNode       // Existing: Comments
```

## Files Modified

1. `src/matra-parser.pegjs` - Grammar extension
2. `src/matra-parser.mjs` - Auto-generated from grammar

## Files Created

1. `tests/function-syntax.test.mjs` - Function syntax tests
2. `tests/v07-compat.test.mjs` - Compatibility tests
3. `tests/mixed-syntax.test.mjs` - Mixed usage tests
4. `docs/function-syntax.md` - Documentation
5. `examples/function-syntax-demo.mjs` - Examples
6. `IMPLEMENTATION.md` - This file

## Next Steps (Optional Enhancements)

Potential future additions (not required for v0.8):

1. **Array Arguments**: `div([p("A"), p("B")])`
2. **Spread Syntax**: `div(...children)`
3. **JSX-like Fragments**: Support for fragment syntax
4. **Type Checking**: Optional TypeScript definitions
5. **Shorthand Properties**: `div({m_if: "show"})` instead of `{"m-if": "show"}`

## Build Commands

```bash
# Regenerate parser from grammar
npm run build

# Run all tests
node --test tests/*.test.mjs

# Run demo
node examples/function-syntax-demo.mjs
```

## Conclusion

The implementation successfully extends Matra with function-style syntax while:

- ✅ Maintaining full backward compatibility
- ✅ Producing identical HAST output
- ✅ Integrating with all template features
- ✅ Providing comprehensive tests and documentation
- ✅ Offering developers choice between two equivalent syntaxes

The function syntax provides a more familiar, JSX-like alternative for developers who prefer that style, while the block syntax remains available for those who prefer the CSS-like approach.
