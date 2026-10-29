# Matra Language White Paper v0.3

[English](./whitepaper-v0.3.md) | [日本語](./whitepaper-v0.3.ja.md) | [Specification index](./README.md)

**Describe structure, connect existing languages, and turn documents into creative work.**

- Date: October 29, 2026
- Scope: the current Matra v0.3 source grammar, document model, execution, and application routes
- Repository baseline: commit
  [`5e11d9d`](https://github.com/matralang/matra/commit/5e11d9de5190d1773f70df4b9180d68807394fd1)
- Status: a non-normative account of design and implementation, not a declaration of release completion or npm publication

## Abstract

Matra is a structural language for connecting documents, data, and programs.
Its center is not an output format such as HTML, but a domain-neutral document tree
with a tag, properties, and ordered children. Evaluating source expressions and control
flow constructs this tree; domain packages connect it to HTML, SVG, and mathematical representations.

The v0.3 design has three pillars:

1. **Treat structure mathematically.** Document Morphion models a node as a finite map
   from exponents to coefficients and supports lossless conversion to and from document AST values.
2. **Learn from existing languages and separate responsibilities.** JavaScript data and
   functions remain JavaScript and connect to Matra document construction through an explicit value boundary.
3. **Connect explanation and execution to creative output.** A Markdown document can hold prose,
   Matra, and JavaScript, execute through WebAssembly, and produce HTML with CSS.

Formalizing a grammar, implementing experimental APIs, validating distribution, and
declaring formal support are different milestones. This paper distinguishes the implemented
subset from future work; it does not claim that all languages and formats have already been unified.

## 1. The problem

Combining documents, computation, graphics, and applications becomes difficult when every
format requires its own tree and conversion machinery. Structure is harder to exchange and
meaning harder to preserve. Moving every operation into a new language, however, would discard
the strengths and ecosystems of existing languages.

Matra places a shared structure between them. The document tree describes what is represented;
evaluators and existing languages perform computation; domain packages determine output.
Names such as HTML's `p` and SVG's `circle` acquire meaning in their domains, not as built-in Core instructions.

The goal is readable structure and explicit connections, not a universal replacement language.
“Learning” here describes a design approach that respects and draws from existing languages.
It does not mean machine learning or automatic acquisition of new grammar.

## 2. Scope and specification relationships

In this paper, v0.3 identifies the current source grammar and development stage.
It is independent of npm package versions, the v0.2 Data Model/AST documents, and the Program ABI draft version.
Its number being lower than the historical v0.6 white paper or Core v0.8 guides does not imply
a simple feature rollback or compatibility with those implementations.

| Document | Responsibility |
| --- | --- |
| [Grammar v0.3](./grammar.md) | Authoritative syntax, parsing, and evaluation for general Matra Programs and compiler source |
| [Data Model](./data-model.md) and [AST](./ast.md) | Evaluated document values, exchange representation, and document Morphion |
| [Matra Program](./program.md) | Native execution profile and provisional compiler ABI |
| [Literate modules](./literate-modules.md) | Implemented explicit-entry/`.js.part` integration and unimplemented later proposals |
| [Portable runtime](./portable-runtime.md) | Minimal host API, portability goals, and limitations |
| [v0.3 release criteria](./release-v0.3.md) | Package priorities, validation records, and publication decisions |

If descriptions conflict, the grammar governs syntax and evaluation; the relevant contract
governs each API and execution route. This paper introduces no new grammar or ABI.

## 3. A shared document model

### 3.1 Separate source syntax from document trees

`parse(source)` returns a `MatraModule` containing declarations, expressions, and control flow.
It is not the document AST consumed by a renderer. A source may contain multiple statements,
so parsing does not require a single root node.

To use an evaluated result as a document, `staticValueToAST()` converts it to a `MatraAST`.
The document data model describes one root node. Each node has three components:

| Component | Content |
| --- | --- |
| `tag` | A string identifying the node |
| `props` | A map from string keys to values |
| `children` | An ordered list of nodes or values |

```json
{
  "tag": "p",
  "props": { "class": "lead" },
  "children": ["Hello", 0]
}
```

The exchange representation, **MatraJSON**, encodes the same node as a fixed three-element array:

```json
["p", { "class": "lead" }, ["Hello", 0]]
```

The tag is a string, properties are a map, and children are a list, unlike historical
representations with missing or `null` slots. Document values are JSON-compatible strings,
finite numbers, booleans, null, arrays, and maps. Functions, `undefined`, BigInt, non-finite
numbers, and cycles are not document values. Functions exposed through JavaScript integration
cannot simply be emitted as document output.

`astToMatraJSON()` and `matraJSONToAST()` connect the document AST and exchange representation.
To preserve data arrays that resemble three-element nodes, follow the wrapping rules in the
[Data Model](./data-model.md#matrajson).
Source positions are parsing metadata, excluded from document equality and MatraJSON.

### 3.2 Document Morphion

A document node can be viewed as a finite map from exponents to coefficients named `val`.
An exponent identifies a position or key within that node.

| Exponent | Meaning of the coefficient |
| --- | --- |
| Numeric `0` | The tag |
| Positive integer `n` | `children[n - 1]` |
| String `key` | `props[key]` |

The preceding document has this term representation:

```json
[
  { "exponent": 0, "val": "p" },
  { "exponent": 1, "val": "Hello" },
  { "exponent": 2, "val": 0 },
  { "exponent": "class", "val": "lead" }
]
```

Numeric `0` and string `"0"` are different exponents, so tag and property addresses do not collide.
`astToMorphion()` and `morphionToAST()` preserve child order, property keys, and values,
excluding source positions. This is a node-level correspondence: child nodes within coefficients
remain document ASTs. Contents of arrays and maps are not implicitly reinterpreted as nodes.

Exactly one tag term is required. Child exponents must be contiguous safe integers starting at 1.
Duplicates, gaps, and invalid exponents are rejected; decoding does not depend on term input order.
Encoding emits the tag, children in order, and properties in UTF-16 code unit key order.
Coefficients such as `0`, `false`, `null`, and the empty string are preserved.

This model provides a mathematical correspondence for structure, not ordinary polynomial computation.
It defines no term addition, multiplication, or zero-term elimination.
It is distinct from the expression-expansion `MorphionForm` in `@matra/math-compute-engine`.
Ordinary HTML generation does not need an intervening Morphion conversion.

## 4. Readable syntax with explicit behavior

Document nodes use `tag.classes(attributes) { ... }`.
Ordinary `name(args)` is a function call, not a node inferred from its name.

```matra
fn double(n) { return n * 2 }
article.card(lang="ja") {
  <h1>Matra</h1>
  ul {
    ...for (n in [1, 2, 3]) { li { double(n) } }
  }
}
```

The list has three `li` children containing `2`, `4`, and `6`.
`for` returns an array of iteration results; `...` spreads that array one level into the child list.
Without `...`, an ordinary array value remains one child rather than being implicitly expanded.

- Newlines or `;` separate statements; spaces alone do not.
- Headers such as `let`, `if`, and `for` permit parenthesis omission under the grammar's rules.
- `if`/`else_if`/`else` returns the selected block value. Loops, assignment, and functions are supported.
- Node attributes permit commas or whitespace/newlines; function arguments, arrays, and objects still require commas.
- Current ordinary strings do not support escapes or embedded newlines. Trailing commas are rejected.

XML-style markup constructs the same nodes as an auxiliary notation.
Attributes are strings, content is text and child elements, and whitespace is preserved.
It supports `.class` shorthand, but not expression interpolation.
`<br />` is accepted; `<br>`, boolean attributes, omitted closing tags, HTML tree repair,
and full XML processing including DOCTYPE and external entities are outside the subset.

v0.3 includes breaking changes within v0.x. Historical `tag[props]`, bodyless function-node syntax,
backtick/tilde text, `$root`, and directive-centered examples must not be used unchanged as current source.
See the [grammar](./grammar.md#status-and-compatibility) for the detailed compatibility policy.

## 5. Parsing, static extraction, execution, and output

```text
Matra source
  -> parse -> MatraModule
      -> evaluateStatic (reject expressions requiring execution)
      or evaluate (explicit execution)
  -> document value -> staticValueToAST -> MatraAST
      -> MatraJSON / document Morphion
      -> domain renderers such as HTML / SVG
```

Static extraction accepts literals, static bindings/references, nodes, and related static constructs.
It rejects calls, operators, control flow, and other execution-dependent expressions with
`EvaluationRequiredError`, without silently falling back to execution.
Syntax errors use `ProgramSyntaxError`.
The current TypeScript `parse()` does not provide `locations` or `sourceId` options.

```js
import { evaluate, parse, staticValueToAST } from "@matra/core"
import { toHTML } from "@matra/html"

const source = `
fn double(n) { return n * 2 }
article.card(lang="ja") {
  <h1>Matra</h1>
  ul {
    ...for (n in [1, 2, 3]) { li { double(n) } }
  }
}
`
const ast = staticValueToAST(evaluate(parse(source)))
const html = toHTML(ast)
// <article lang="ja" class="card"><h1>Matra</h1><ul><li>2</li><li>4</li><li>6</li></ul></article>
```

Renderers apply domain-specific output rules to document trees.
`@matra/html` handles HTML escaping and void elements; Core tags do not embed HTML semantics.
Escaping is an output feature, not a guarantee that arbitrary documents can safely be executed or served.

## 6. Connecting Markdown and JavaScript

### 6.1 Keep explanation with source

Named fences in Markdown are virtual files. YAML FrontMatter selects the entry and exposed values;
unselected blocks are not executed. The following can be saved as one `example.md`:

````markdown
---
matra:
  entry: main.matra
  values:
    - data.js.part
    - analytics/total.js.part
---

# Build a document from data

```data.js.part
[10, 20, 30]
```

```analytics/total.js.part
values => values.reduce((sum, value) => sum + value, 0)
```

```main.matra
p { analytics.total(data) }
```
````

A `.js.part` body is one JavaScript expression and may expose functions as well as data.
`analytics/total.js.part` becomes `analytics.total` in Matra.
Standard `.js` module import/export, npm, and direct Python integration are not implemented in this initial route.
The loader neither parses all Markdown through the Matra grammar nor automatically renders its prose as HTML.

### 6.2 Separate build and run

```js
import { readFile } from "node:fs/promises"
import { staticValueToAST } from "@matra/core"
import { buildLiterate, runLiterate } from "@matra/core/experimental/literate"
import { toHTML } from "@matra/html"

const markdown = await readFile("example.md", "utf8")
const bundle = await buildLiterate(markdown, { document: "example.md" })
const value = await runLiterate(bundle)
const html = toHTML(staticValueToAST(value))
// <p>60</p>
```

Build validates configuration, names, and expression syntax and compiles Matra to Wasm.
It does not execute user code in the document.
Run initializes each selected JavaScript expression once in path order, then executes the Matra entry in Wasm.
Each run receives a fresh JavaScript context. This host integration route is separate from Core's ordinary `evaluate()`.

Values are copied across an explicit boundary. The supported data subset is JSON-compatible,
with JavaScript functions additionally exposable to Matra. Cycles, accessors, custom prototypes,
sparse arrays, `undefined`, non-finite numbers, and Promises are rejected.
Passing Matra functions to JavaScript and asynchronous integration are not supported.
Document output cannot contain functions.

This is an experimental Node.js 22/24 subpath, not an API with stable compatibility guarantees.
Distribution is designed and implemented to bundle the corresponding compiler Wasm, so use after
installation requires neither Rust nor an additional compiler download. Building and validating
the distribution in the repository still uses Rust and bootstrap.
Distribution implementation and pack validation do not imply npm publication.

`LiterateError` retains a code, document name, virtual path, line, and available cause.
Compile diagnostics map to the original document; runtime errors identify the entry block,
not an expression-level source map. There is no OS sandbox or timeout guarantee.
Only trusted documents and bundles should be executed.

## 7. Self-hosting and WebAssembly

The Matra-written compiler can compile its own Matra compiler source to Wasm.
Validation starts with a Rust seed:

```text
Rust seed + compiler source -> Stage 1 Wasm
Stage 1  + compiler source -> Stage 2 Wasm
Stage 2  + compiler source -> Stage 3 Wasm
                              Stage 2 == Stage 3 (byte-for-byte)
```

`pnpm bootstrap:verify` checks byte equality as well as shared acceptance, rejection,
execution fixtures, and the portable sample at each stage.
This demonstrates bootstrap reproducibility, not correctness for every input or production compiler maturity.

General documents use a host value profile; a `module` declaration selects the native compiler profile.
They share the standard grammar, but the native profile uses a limited type/ABI subset with
`i32`, `bytes`, arrays, and struct pointers. There is no implicit conversion between profiles.
ABIs such as the compiler's 36-byte result record and `matra-value-1` are managed separately
from the source grammar version.
The compiler remains experimental; resource limits, fuzzing, and ABI stabilization are continuing work.
See the [seed compiler documentation](../crates/matra-seed/README.md).

## 8. Portability and host responsibilities

The goal is to resolve dependencies, start, build, and run the same project on Windows,
macOS, and Linux without rewriting source or configuration. Portability including dependencies
takes priority over arbitrary external CLI compatibility.

The current small working subset uses a Node.js host. An explicitly injected `runtime`
binding provides version information, arguments, UTF-8 text file reads/writes, and stdout.
Paths are root-relative with `/` separators; case mismatches, symlinks, invalid UTF-8,
and related problems produce diagnostics. These checks serve portability, not OS security isolation.

The baseline commit's [release checklist](./release-v0.3.md#release-checklist)
records completion of producing identical sample HTML on Windows/macOS/Linux with Node.js 22/24.
This is evidence for the sample and validation environments, not a formal support declaration
covering arbitrary dependencies or minimum OS versions.
A standalone runtime, package manager, general task engine, and npm/Python integration remain future work.

## 9. Application packages and maturity

| Layer/package | Current responsibility | Important limitation |
| --- | --- | --- |
| [`@matra/core`](../packages/core/README.md) | Parsing, static extraction/evaluation, document AST, MatraJSON, document Morphion, traversal/transformation | `MatraModule` is not a document AST; general `.jsonm` is not implemented |
| [`@matra/html`](../packages/html/README.md) and [`@matra/styles`](../packages/styles/) | HTML output, CSS, and the web page generation route | Not a complete web framework, hydration system, or general site generator |
| [`@matra/graphics`](../packages/graphics/README.md) | SVG from shared ASTs, shapes, defs, and filters | Does not imply completed Canvas/WebGL or animation support |
| [`@matra/math`](../packages/math/README.md) | MathJSON exchange, Content MathML MVP, CD-aware meaning representation | Not full MathML implementation/conformance or mathematical equivalence checking |
| [`@matra/math-compute-engine`](../packages/math-compute-engine/README.md) | Compute Engine evaluation, simplification, numeric evaluation, expression Morphion | Distinct from document Morphion; expansion has a 256-term limit and is not general equivalence checking |
| [`@matra/command`](../packages/command/README.md) | Inspectable plans, explicit authorization, process execution, JSON/NDJSON | Authorization metadata is not process isolation; this is separate from the portable runtime API |
| [`@matra/kernel`](../packages/kernel/README.md) and [VS Code extension](../packages/vscode/README.md) | Notebook display and editing support | No promise of persistent sessions, a complete Notebook experience, LSP, or full type inference |

The math domain uses Content MathML as its semantic basis, Strict Content MathML as a structural
normal form, and OpenMath CDs for symbol identity. MathJSON is an engine exchange format.
The shared document AST, mathematical meaning model, and computation engine are separate concerns.
Domain packages may retain historical APIs or source examples; current general `.matra` syntax
is governed by the current grammar.

## 10. Reproducible validation routes

In a repository checkout, prepare Node.js 22/24, the pnpm version selected by the root
`packageManager` field, and the repository's Rust toolchain. Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm example:web-page
pnpm test:web-page
```

The [executable web page document](../packages/html/examples/web-page.md) combines JavaScript
data/functions, Matra iteration/document construction, and Wasm execution to generate
`packages/html/examples/dist/index.html` and `matra.css`.
The output can be viewed offline. Its test checks three articles, a 24-minute total,
escaping, equality of the generated file and rendered result, and a fixed checksum.
It does not perform document Morphion conversion.

Additional validation entry points are:

```sh
pnpm test:literate:package
pnpm test:portable
pnpm bootstrap:verify
```

They respectively validate packed installation outside the checkout with Rust-free API/CLI use,
host APIs and sample build/run, and self-hosted byte equality with shared behavior at each stage.
These are reproduction instructions, not a statement that all commands were newly executed
merely by writing this paper. Release decisions should record the fixed commit, distribution,
checksums, and corresponding CI results together.

## 11. What is retained and revised from historical papers

The October 2025 Japanese document calls itself “White Paper v0.6”; the supplied English
document is “Language Specification v0.2 (Draft).” They are not translations of one revision
and are not normative references for current v0.3.
The shared-structure vision and self-description goal are retained, with clearer boundaries
and implementation scope.

| Historical description or proposal | Current v0.3 interpretation |
| --- | --- |
| Unify documents, data, and code around Matrast | Distinguish `MatraModule`, document `MatraAST`, and MatraJSON; define document Morphion correspondence |
| Nullable/optional tuple slots and `Entry[]` roots | Document exchange uses `[string, map, list]`, separate from source-module statements |
| Parse mixed Markdown, HTML, and JSON through Peggy | Separate standard Matra grammar, limited XML-style markup, Markdown fence loading, and JSON exchange |
| HTML template interpolation, `m-if`, and `m-each` | Current standard source uses expressions, `if`, `for`, and explicit child spreading; historical directives are not grammar authority |
| Proposed outputs such as `toTeX`, `toESTree`, and `toCanvas` | Representative current routes are HTML, SVG, and math exchange; the complete historical renderer list is not inherited as implemented APIs |
| Self-hosting as a future goal | Rust seed and the Matra-written compiler support Stage 2/3 byte-equality validation |

The historical [Core v0.2 grammar](./archive/core-v0.2/grammar.md) and
[Core v0.8 guides](./archive/core-v0.8/README.md) remain in the existing archive.
The old [directive guide](./archive/core-v0.8/03-directives.md) documents the HTML template design of its time.
The external historical papers are not reintroduced as current specifications; this paper
provides the entry point to the current account.

## 12. Direction

v0.3 prioritizes a coherent document model and small, verifiable routes from explanation to
execution and output. Public APIs, compiler artifacts, diagnostics, and distribution should
remain aligned, while SVG, mathematics, and editor maturity are reported individually.

Later work includes standard JavaScript modules, npm/Python connections, a runtime covering
dependencies, more detailed source maps, resource limits, and ABI stabilization.
These require further design and validation and are not implemented features of the current subset.
v0.x favors familiar notation and experimentation; work toward v1.x strengthens type safety,
static analysis, and compatibility guarantees.

Matra does not make all domain meanings identical.
It shares structure, separates the layers that assign meaning, and connects languages and
outputs explicitly. Preserving those boundaries while turning readable documents into a basis
for executable creative work is the position of v0.3.
