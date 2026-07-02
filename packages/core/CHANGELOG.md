# Changelog

All notable changes to @matra/core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2025-10-24

### Added

- **Function-style syntax** - New alternative syntax alongside block-style:
  - `p("Hello")` - Simple elements
  - `div({class:"container"}, ...)` - Elements with properties
  - `nav(ul(li(...), li(...)))` - Nested function calls
  - Full HAST compatibility - produces identical output to block syntax
- **Extended grammar** with new PEG rules:
  - `TagApply` - Main function call parsing
  - `ArgList` - Comma-separated arguments
  - `Arg` - Argument types (objects, strings, numbers, booleans, nested calls)
  - `BareObject` - Property object literals `{key:"value"}`
  - `Identifier` - Valid tag and property names
  - `Number` - Numeric literal support
  - `Boolean` - `true`/`false` literal support
- **Property value types** - Support for strings, numbers, and booleans in properties
- **Comprehensive documentation**:
  - `docs/function-syntax.md` - Complete syntax guide
  - `docs/QUICK-REFERENCE.md` - Side-by-side syntax comparison
  - `examples/function-syntax-demo.mjs` - 11 practical examples
- **Test coverage** - 30 new tests:
  - Function syntax tests (10)
  - v0.7 compatibility tests (11)
  - Mixed syntax tests (9)

### Changed

- Parser rule priority - `TagApply` added as first alternative in `Block`
- Grammar updated to distinguish between property objects and element blocks

### Fixed

- None (fully backward compatible)

### Documentation

- Complete function syntax guide with examples
- Quick reference comparing both syntaxes
- Implementation summary with grammar details
- Demo file with 11 practical examples

### Notes

- **100% backward compatible** - All v0.7 syntax continues to work
- Both syntaxes produce identical HAST nodes
- Works seamlessly with all template features (m-if, m-each, {{mustache}})
- No changes required to `transform.mjs`, `render.mjs`, or other modules

## [0.7.0] - 2025-10-23

### Added

- **Attribute-based directives** support in `transform()`:
  - `m-if="condition"` - Conditional rendering on regular elements
  - `m-each="items" m-as="item"` - Array iteration on regular elements
  - `m-else` attribute - Alternative content when `m-if` is falsy
  - Fully compatible with jp-butchi's existing template syntax
- **Template literal support** in `with_()`:
  - Now accepts both plain strings and template literals
  - Compatible with tagged template literal syntax: `` with_(ctx)`div { ... }` ``

### Changed

- `transformWithScopes()` completely rewritten to prioritize attribute directives over tag directives
- `transform()` now correctly handles single node inputs (returns null when filtered out)
- `toHTML()` enhanced with HAST/MDAST node type support
- `render.mjs` enhanced with `renderHastNode()` function for HAST format support

### Fixed

- Attribute-based directives now work correctly with `m-else` siblings
- Empty results from falsy `m-if` conditions are now properly handled
- Scope management for nested `m-each` iterations
- Template literal interpolation in `with_()` function

## [0.6.0] - 2025-10-22

### Added

- Template transformation engine (`transform.mjs`)
  - Tag-based directives: `m-if[test="..."]`, `m-each[of="..." as="..."]`, `m-else`
  - Mustache variable interpolation: `{{variable}}`, `{{object.property}}`
  - Scope management for nested iterations
- `with_(context)` helper function for creating reusable template functions
- `compile()` now accepts `opts.context` for template evaluation

### Changed

- API expanded with `transform`, `with_()` exports
- `matra()` unified API now supports context parameter

## [0.5.0] - 2025-10-21

### Added

- Multiple output formats:
  - `toTeX()` - LaTeX output
  - `toESTree()` - ESTree AST (stub)
  - `toCanvas()` - Canvas rendering (stub)
- `evaluate.mjs` and `evaluator.mjs` modules

## [0.4.0] - 2025-10-20

### Added

- Initial ESM module structure
- Peggy parser integration (`matra-parser.mjs` generated from `matra-parser.pegjs`)
- Basic rendering: `toHTML()`, `toJSON()`
- Type definitions (`types.mjs`)

## [0.3.0] - 2025-10-19

### Added

- Core parser functionality
- HAST-compatible AST structure

## [0.2.0] - 2025-10-18

### Added

- Project initialization
- Basic package configuration

## [0.1.0] - 2025-10-17

### Added

- Initial repository setup
