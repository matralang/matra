# v0.3: proposed scope and release criteria

[English](./release-v0.3.md) | [日本語](./release-v0.3.ja.md) | [Index](./README.md)

## Goal

v0.3 is an experimental release that establishes a Morphion-based document model,
explicit connections to existing languages, and output routes for creative systems.
Priorities follow foundation consistency, implementation maturity, dependencies,
and the ability to verify behavior.
The audit baseline is develop commit `1a4b65fd108248bd7e6b917c37ed3130d24a2537`.

The first validation route goes from document source through explicitly selected
JavaScript values and functions to reproducible HTML and CSS, exercising the
connections between layers. Language specification, npm package versions, and
compiler ABI are separate. Release notes must identify supported routes and
verified environments without treating every package as equally complete.

## Philosophy and completion criteria

| Principle | Evidence for v0.3 |
| --- | --- |
| A mathematical model based on Morphion | Treat Matra AST structure as a finite term representation: map exponent 0 to tag, positive integer n to children[n - 1], and string key to props[key], preserving document meaning through round trips |
| Learning from and respecting existing languages | Use ordinary JavaScript objects, arrays, and functions, with explicit public names and value boundaries |
| Creative systems | Generate a Web page from prose and code; validate SVG and math as representative creative routes |

The definition is recorded in the
[document data model](./data-model.md#morphion-correspondence). Here, Morphion
is a concept for treating Matra AST as a coherent mathematical model, not just
as a conversion format. Instead of viewing a node as a tuple of tag, ordered
children, and keyed properties, it represents each element as a finite
mapping from exponents to coefficients `val`. Each exponent uniquely identifies
a position or key within the node. This correspondence preserves child order,
property keys, and value types and contents, and allows AST and Morphion to be
reconstructed from one another. Source positions are parser metadata and are
not part of this correspondence.

Core's `MatraMorphion` is node-local. Nested nodes remain existing document ASTs
inside coefficients, and the same correspondence can be applied recursively to
those nodes. Arrays and maps are not reinterpreted as nodes. Numeric and string
exponents are distinct domains: numeric `0` denotes the tag, while string `"0"`
denotes a property key. Since terms represent document positions and keys,
coefficient `0` and empty values are retained as ordinary values.

This does not mean polynomial expansion, nor does it define term addition,
multiplication, like-term collection, or zero-term elimination. The document
Morphion concept and correspondence are introduced in v0.3, without changing
Matra grammar, evaluation, or compiler ABI.

The existing Compute Engine adapter's `MorphionForm` is a derived expression
expansion, distinct from the document model. Content MathML/CD provides semantic
interchange, MathJSON is the engine boundary, and the expression MorphionForm
represents bases, exponent vectors, and coefficients. The two Morphion forms
share the vocabulary of terms, exponents, and coefficients, but document
Morphion exponents denote AST positions or keys, while expression Morphion
exponents denote powers of bases. They do not share semantics or operation rules.

## Package and implementation priorities

P0 blocks the release; P1 refines and validates a limited existing feature;
P2 preserves working behavior without expanding scope.
Complete the foundation, language integration, and creative output routes in
that order, respecting dependencies. The table is based on source inspection.

| Target | Current implementation | Priority | v0.3 completion scope | Excluded commitments |
| --- | --- | --- | --- | --- |
| `@matra/core` | v0.3 parser, static retrieval, explicit evaluation, document AST, traversal, JSONMatra helpers; document Morphion conversions added here | P0 | Document Morphion round trips and exponent validation, Module/document distinction, document construction and loops, current API documentation, diagnostic limitations | General `.jsonm`, unified source maps, strict type system |
| `@matra/html` | Escaping, void elements, pretty output, base paths | P0 | Complete document, escaping and repetition from JS data in the validation example | Full Web framework, hydration, general site generator |
| literate host / `matra-seed` | Rust seed, Matra-written Wasm compiler, explicit entry and `.js.part`, JSON bundle, portable file APIs | P0 | Build→execute→HTML, original-document diagnostics, preserve Stage 2/3 byte equality | Standard JS modules, npm/Python import, standalone runtime or package manager |
| `@matra/core/experimental/literate` | Public subpath and types, build/run, bundled compiler, `matra-literate` CLI, and packed distribution tests implemented; npm publication and remote validation pending | P0 user-facing delivery | Experimental Node.js APIs, FrontMatter configuration, bundled compiler Wasm, dependency separation from ordinary Core entry, CLI over the same API, installation example outside the checkout | Browser support, a separate evaluator, general sandbox guarantees, extraction into a separate npm package |
| `@matra/math` | MathJSON bridge, object form, Content MathML MVP, Morphion types | P1 | Distinguish document Morphion, describe semantic boundaries, round-trip representative supported expressions | Full MathML, MathML 4, general equivalence testing |
| `@matra/math-compute-engine` | Evaluation, simplification, numeric approximation, Morphion conversion, property evaluation | P1 | Test finite sums, like terms, function atoms, negative integer powers, 256-term limit; inspect domains including division by zero and reproducible ordering | Complete engine-independent computation, general equivalence testing |
| `@matra/styles` | No-class CSS and a few helpers | P0 validation route | Bundle CSS with generated pages for offline reading | New design system or themes |
| `@matra/graphics` | SVG shapes, defs, filters, legacy drawing API | P1 | Reproduce existing examples; optionally embed one figure in HTML | Canvas/WebGL, animation, legacy API expansion |
| `@matra/command` | Planning, authorization, processes, JSON/NDJSON, Node/Worker adapters | P1 | Correct current-grammar planning example; one JSON command if needed | Python package integration, arbitrary-process isolation, new workflow system |
| `@matra/kernel` | Jupyter protocol, HTML/SVG/AST display using static retrieval | P2 | Preserve tests; include only after actual Jupyter validation | Persistent Matra sessions, comprehensive Notebook/Colab support |
| `matra-vscode` | Highlighting, formatting, outline, simple diagnostics | P1 current syntax / P2 expansion | Formatting preserves validation examples using current syntax | LSP, full type inference, new legacy-directive features |
| `apps/website` and separate official site | Legacy site remains in monorepo; README points to another repository | P1 user entry | Align linked v0.3 instructions after separately auditing the official site | Claiming the official site is updated based on this repository |

The [literate public API contract](./literate-modules.md#v03-public-api-and-distribution-contract)
defines APIs and distribution gates. Preserve existing P0 correctness, value
boundaries, diagnostics, and bootstrap first, then establish bundled compiler
generation/verification and complete the subpath and installation examples
before P1/P2 expansion. Internal functions are not already published APIs.
Standalone packaging is deferred; the CLI is named `matra-literate`.

## First validation example

The [Web page document](../packages/html/examples/web-page.md) exercises
Matra construction and expansion, JavaScript data and functions, Wasm execution,
HTML rendering, and bundled CSS. Core and the specification define and validate
document Morphion as a mathematical model; this practical HTML route does not
perform an unnecessary Morphion conversion. Article data is fictional and does
not perform expression-expansion Morphion computation.
Node.js 22/24 and the repository's Rust toolchain are required.

```text
pnpm install --frozen-lockfile
pnpm example:web-page
pnpm test:web-page
```

Outputs are `packages/html/examples/dist/index.html` and `matra.css`.
Regression tests check language and charset, three expanded articles, the 24-minute
total, and text escaping. Generated pages can be read offline.
The example imports the public subpath. `pnpm test:literate:package` packs Core
and HTML and checks APIs, CLI, types, and HTML generation in an empty project
outside the checkout. The current Rust
requirement applies to repository bootstrap. The planned public subpath uses
the bundled compiler without requiring user-side Rust or compiler downloads.

## Validation status

The initial local full build, lint and tests passed. Core passed 241 tests,
including six new cases; HTML passed nine, Rust seed passed 28, and compiler/host
JavaScript tests passed 281. Existing tests in the other workspace packages also
passed. The separate Web page integration test passed one case. Run it explicitly
with `pnpm test:web-page` to avoid adding a Rust requirement to ordinary HTML
package tests. Static document, template, and function/loop README examples were
also executed and their HTML verified.

The new Core API and validation example were directly tested with Node.js 24.17.0.
The new remote CI, validation examples on other OSes,
official site alignment, and visual review of the generated page remain pending.
Local success alone does not complete the release criteria.

Literate distribution tests verify first use with a PATH that cannot locate Rust
and a nonexistent bootstrap cache, and reject missing/corrupt compiler Wasm and
unsupported bundles. The compiler is 111,064 bytes; a manifest records version,
SHA-256, and ABI, and builds verify Stage 2/3 byte equality. These are local
results; packed distribution validation across all supported OS/Node versions
still awaits successful CI.

## Implementation stages and completion criteria

| Stage | Work | Completion evidence |
| --- | --- | --- |
| 1: Baseline | Audit packages, correct outdated API examples, add document→HTML validation | Baseline build/test/lint results, generated HTML and regression test |
| 2: Foundation | Check document Morphion implementation against its contract and fix document/JS integration | Model contract, domain and acceptance/rejection tests, reproducible instructions |
| Between 2 and 3: Distribution preparation | Specify public build/run contracts; bundle compiler Wasm and provide Core subpath, types, and CLI | Public exports, dependency separation from ordinary entry, supported ABIs, compiler versions/checksums and size, first-use and failure tests |
| 3: Applied routes | Validate existing SVG, math, and editor features with representative examples; test distribution | Packed packages, rendered output, supported OS validation |
| 4: Release candidate | Freeze grammar, APIs and validation examples; verify v0.3 candidate | Pinned commit, versions/checksums, release notes, Stage 2/3 equality, successful CI |
| 5: Release decision | Check required criteria and known limitations, then publish experimental v0.3 | Reproducibility from the pinned version, installation and acquisition instructions, implementation/specification agreement |
| 6: After release | Correct setup instructions, documentation and bugs; patch release if needed | Change history and validation results |

Release notes describe completed P1/P2 scope. Unfinished extensions do not become
additional P0 release conditions. If P0 fails, reassess scope; an experimental
label alone does not satisfy the criteria.

## Release checklist

- [x] Specify and test document Morphion correspondence, conversions, and undefined operations
- [ ] Pin validation sources, commands and outputs to a commit
- [x] Pass `pnpm run build`, `pnpm test`, `pnpm run lint`, and `pnpm test:web-page`
- [x] Verify Stage 2/3 byte equality with `pnpm bootstrap:verify`
- [ ] Obtain the same validation HTML on Windows/macOS/Linux with Node.js 22/24
- [x] Pack release packages and run validation examples from a separate empty project
- [x] Implement literate public APIs, types, and error contracts; run build→run→HTML without internal relative imports or checkout dependencies
- [x] Document compiler provisioning, supported ABIs, and network/Rust requirements; verify uncached first use
- [x] Pin instructions for compiler Wasm, checksums, source, and execution host
- [ ] Align official site, README and specifications on environments, dependencies and limitations
- [ ] Do not describe standard JS modules, npm/Python integration or general `.jsonm` as implemented

The existing [portable CI](https://github.com/matralang/matra/actions/runs/40418928782)
passed at the baseline commit. This does not validate the example HTML, all
packages, or published artifacts. The added web-page CI covers dependency
installation, HTML generation and verification on three OSes with Node.js 22/24.
Adding CI configuration is separate from observing its successful remote run.
