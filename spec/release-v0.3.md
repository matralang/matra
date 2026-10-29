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
| Separate official website (`apps/website` is legacy) | Official source also retains old parser APIs/syntax and sibling-checkout dependencies; initial inspection below is not runtime validation | P0 bilingual user entry and current-spec alignment / P1 migration to the new system | General-audience Japanese/English pages, setup/example/white-paper links, and a v0.3 Playground plan; validate static generation separately from browser execution | Full migration before a Playground prototype, browser support for the Node.js literate API, a new general site generator |

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
The portable-runtime CI, including the Core browser entrypoint, passed on commit
`6b78dd4` across all six Windows/macOS/Linux and Node.js 22/24 combinations. Core tests
and packed literate distribution tests passed in each job
([GitHub Actions run 40969391013](https://github.com/matralang/matra/actions/runs/40969391013)).
The applied-route tests and packed distributions also passed in all six
combinations on follow-up commit `1578bd1`
([GitHub Actions run 40974296046](https://github.com/matralang/matra/actions/runs/40974296046)).
The official website's bilingual pages, Playground, and visual/interaction review
are recorded separately below.

Literate distribution tests verify first use with a PATH that cannot locate Rust
and a nonexistent bootstrap cache, and reject missing/corrupt compiler Wasm and
unsupported bundles. The compiler is 111,064 bytes; a manifest records version,
SHA-256, and ABI, and builds verify Stage 2/3 byte equality. The same CI run
also passed packed literate distribution validation across all supported OS/Node
versions.

## Official website: bilingual entry and migration to the new system

### Prerelease distribution for the website

Prepare `@matra/core` and `@matra/html` at `0.3.0-alpha.0` for publication under
the npm `next` tag. This prepares public APIs and distributions for website validation;
it is not the final v0.3 release. Updating versions does not mean they are published.
Leave the existing `latest` tags unchanged. Other packages are outside this publication.

Before publication, run `pnpm run lint`, the Core/HTML tests, and
`pnpm test:literate:package`. Distribution verification also checks package versions,
HTML's Core peer dependency, and the bundled compiler manifest version.
Record the corresponding commit and CI results, verify npm authentication and
publication permissions, then publish Core followed by HTML.

```sh
pnpm --filter @matra/core publish --tag next --access public
pnpm --filter @matra/html publish --tag next --access public
npm view @matra/core@0.3.0-alpha.0 version dist.integrity
npm view @matra/html@0.3.0-alpha.0 version dist.integrity peerDependencies
npm view @matra/core dist-tags --json
npm view @matra/html dist-tags --json
```

After publication, verify document-to-HTML generation with packages fetched from the
registry and associate tarball integrity and the bundled compiler manifest with the
release record. Pin both website dependencies to `0.3.0-alpha.0` and maintain the
lockfile. Do not use the moving `next` tag for reproducible dependency specifications.

#### alpha.0 publication record

Core and HTML `0.3.0-alpha.0` were published under the npm `next` tag on
October 30, 2026 (Japan time), from
[`930d378`](https://github.com/matralang/matra/commit/930d3780d02ff9ca9c4bbfea4b9101da51dfbd6d),
with the corresponding tag `v0.3.0-alpha.0`. This tag covers only the Core/HTML
prerelease, not completion of other packages or the official website.
[CI](https://github.com/matralang/matra/actions/runs/40959292210) passed all six
Windows/macOS/Linux × Node.js 22/24 combinations. Local lint, 247 Core tests,
9 HTML tests, 1 web-output test, and packed distribution verification also passed.

Both packages were installed from npm into an empty project outside the checkout.
Static HTML, base paths, document-to-HTML generation, and the CLI passed with an
empty PATH and a nonexistent bootstrap cache, confirming Rust-free execution.
Registry tarball integrity matched the tarballs verified before publication.
The `latest` tags remain Core `0.2.1` and HTML `0.1.0`.
Registry-installed execution was verified on macOS with Node.js 24.17.0;
this is not registry-installation verification across all operating systems.

```text
@matra/core@0.3.0-alpha.0
integrity: sha512-JQa+0M05E9squGXE2O/+VJgvFKLVLWnVGlE8iPitFzI9VnB3Sqxla4bzL5HHdzLIsgHC/ZoHWpQVQkWx3lTElA==
@matra/html@0.3.0-alpha.0
integrity: sha512-CtxcF6t8o/6HBvZhuMb4eyetHQNDMCNAIGBjCyn7++Wlxlk/CSrE/9cf3757RxyxTnQt15cuPRVAPYrb0Tpo/w==
compiler version: 0.3.0-alpha.0
compiler ABI: matra-value-1
compiler bytes: 111064
compiler SHA-256: c9778e9e641bf82031b7fb5c0658dce2167d833c31487409cbdcac09fbad2efd
compiler source SHA-256: 14bf69578be0b705a83942ddfdcf6ada34eb0dfd519702daad6051a6ad6e10c6
Stage 2/3: byte-identical
```

The website pins Core `0.3.0-alpha.1` and HTML `0.3.0-alpha.0`.
Migrating Graphics/Math dependencies remains a separate task.

```sh
npm install --save-exact @matra/core@0.3.0-alpha.1 @matra/html@0.3.0-alpha.0
```

These v0.3 tasks were added on October 29, 2026. Implement them in
[`matralang/website`](https://github.com/matralang/website), not by rebuilding
the monorepo's legacy `apps/website` as the official site.
The [white paper](./whitepaper-v0.3.md) supplies technical grounding; the website
should start with what readers can use Matra for and what they can create.
The work plan below is followed by a separate record of completed changes.

### P0: general-audience Japanese and English content

- Provide the top page and “What is Matra?” in Japanese and English, explaining
  uses, completed examples, and development status without requiring knowledge of
  ASTs, Morphion, or Wasm. Link interested readers to the white paper.
- Pair a short source document with its generated page and connect it to setup,
  runnable examples, the white paper, and specifications. Distinguish unimplemented features.
- Provide language switching between corresponding pages, navigation, and document
  language metadata. Keep instructions and scope consistent in both languages.
- Check existing URLs and the GitHub Pages base path; provide migration links if URLs
  change. Validate mobile layout, keyboard use, links, example code, and output.

### P1: site generation with the new system

Here, the “new system” means current v0.3 document construction, build/run through
the Node.js `@matra/core/experimental/literate` API, and HTML output through `@matra/html`.
First generate representative Japanese/English pages from Markdown prose, named fences,
and explicit entries. Validate shared layout, navigation, CSS, static assets, base paths,
and reproducibility. Use Node.js at build time and serve the generated static site on
GitHub Pages. Do not introduce arbitrary JavaScript module integration or a browser
literate API as prerequisites.

The initial official-site inspection baseline is
[`42d663f`](https://github.com/matralang/website/commit/42d663f4a6557808e0a50adec073fc4f7ddd6505).
Its `src/build.ts` passes old `parse()` results directly to the renderer;
`src/client/core-browser.ts` and browser bundling reference internal build outputs
from a sibling Matra checkout. Dependencies also include `file:../matra/...`.
Move toward reproducible builds using distributed packages or explicitly pinned source
in CI. Record versions, commits, and compiler artifacts, without implicit dependence
on a developer's directory layout.

### Prototype the Playground first

Generating the Playground page with the new system and executing user input in the
browser are separate tasks. The current `src/client/playground.ts` uses old parse
options, treats parse results as document ASTs, and includes old-syntax examples.
Do not move the Node.js literate API directly into the browser.

1. Inventory HTML, SVG, Math, and JavaScript modes, examples, previews, diagnostics,
   and copy/download behavior; identify what is retained, migrated, or deferred.
2. Prototype current v0.3 parsing, static extraction or explicit evaluation, document
   AST conversion, and rendering in the browser. Validate Math through its domain
   route. Investigate browser compiler/host compatibility separately only if Wasm is needed.
3. Validate explicit execution, running status, cancellation/restart through Workers
   or equivalent isolation, timeout and syntax/runtime diagnostics, and isolated previews.
   Verify that an infinite loop cannot freeze the UI, without claiming a general sandbox.
4. Test representative HTML/SVG examples, invalid input, and cancellation in real browsers.
   Measure initial download size, startup time, and execution response; record results
   and acceptance criteria before deciding the scope and feasibility of full migration.

Even a full migration can generate static content separately from Playground client assets.
If browser execution requires substantial additional infrastructure, publish bilingual
content first. Offer only Playground modes validated against current v0.3, or explicitly
state their unavailability and link to local examples. Do not present old syntax as v0.3.
Record removed functionality and alternatives. Release notes must state deferred
migration work and reasons rather than treating incomplete work as successful.

#### alpha.1 browser entry point publication record

`@matra/core@0.3.0-alpha.1` was published under npm's `next` tag on
October 30, 2026 (Japan time). `npm view` confirmed the published version;
`latest` remains `0.2.1`, while `next` is `0.3.0-alpha.1`. The registry integrity is:

```text
@matra/core@0.3.0-alpha.1
integrity: sha512-KmSsuLfkwOeHaK9bLjrSN7r/MesBlhzrkiS8JPIzAnmAKQSDC4+t0Ifldh1oYZ7yNHWC8f8bSo4f01bAMr6iIA==
exports: ., ./browser, ./experimental/literate
```

The `./browser` subpath provides parsing, explicit evaluation, and document AST
conversion without the Node.js file loader. It was added in the Core public API
commit `83e2891` and published after the alpha.1 version-preparation commit
`1aa7540`. Core tests and packed-package verification passed. Registry-installed
execution was checked on macOS with Node.js 24; this is not cross-OS registry
installation verification or a claim that remote CI passed.

#### Website / Playground prototype completion record

The official site was updated on October 30, 2026 in
`matralang/website` commit `aaab33a`.
The Japanese and English Playground uses the current Core browser API and HTML renderer.
It provides explicit execution, Worker termination, a 10-second timeout, syntax/runtime
error display, and an iframe preview with an empty sandbox attribute. Integrated
Chromium verified manual cancellation of a synchronous loop, timeout, reruns, syntax
and runtime errors, blocked script execution in the preview, and CSP blocking an
external image request. SVG, Math, JavaScript module imports, and copy/download remain
deferred, with the Node.js examples linked as the alternative. Both languages state
that the Worker/iframe combination is not a general-purpose security sandbox.

Local `npm ci`, `npm test`, `npm run build`, base-path and internal-link checks, and
reproducibility checks passed. The client bundle is 3,374 bytes (1,464 bytes gzip);
the Worker bundle is 17,588 bytes (5,722 bytes gzip). The prototype target is at most
32 KiB gzip for both assets and under 100 ms from Worker startup to response for a
representative short document. In this environment the first run took 25 ms and the
next four took 16–18 ms. These are localhost observations from one browser environment,
not performance guarantees across networks, devices, or supported browsers.

**Playground decision:** adopt the limited HTML mode and defer full migration of SVG,
Math, and other features. The supported functionality, diagnostics, stop/timeout
behavior, iframe restrictions, bilingual instructions, bundle size, response timing,
unsupported scope, and local alternative have been documented. The website and
Playground items in the release checklist are therefore complete.

#### SVG, math, and editor applied-route validation

On Node.js 24, the existing tests passed for `@matra/graphics` (16), `@matra/math`
(24), `@matra/math-compute-engine` (15), and the VS Code editor (8). The Graphics,
Math, and Compute Engine packages were packed with `pnpm pack`, then all three
tarballs were installed into a temporary consumer alongside the published
`@matra/core@0.3.0-alpha.1`. The consumer successfully generated SVG, parsed
MathJSON, serialized/normalized Content MathML, and evaluated
`evaluateMatra("Add(1, 2, 3)") === 6`. Integrated Chromium displayed the generated
`basic.svg`.

The portable-runtime matrix also ran the existing tests for Graphics (16), Math
(24), Compute Engine (15), and the VS Code editor (8), and installed all four
tarballs into an isolated npm consumer. Representative SVG generation, MathJSON
parsing, Content MathML serialization/normalization, evaluation, and editor
manifest/grammar distribution checks passed on Windows/macOS/Linux with Node.js
22/24 in all six jobs ([run 40974296046](https://github.com/matralang/matra/actions/runs/40974296046)).
The generated SVG was visually checked in Integrated Chromium on macOS with
Node.js 24. Content MathML was validated semantically, not as browser-rendered
visual math. The editor package assets and tests were checked; the VS Code host
was not launched for interactive integration testing.

## Implementation stages and completion criteria

| Stage | Work | Completion evidence |
| --- | --- | --- |
| 1: Baseline | Audit packages, correct outdated API examples, add document→HTML validation | Baseline build/test/lint results, generated HTML and regression test |
| 2: Foundation | Check document Morphion implementation against its contract and fix document/JS integration | Model contract, domain and acceptance/rejection tests, reproducible instructions |
| Between 2 and 3: Distribution preparation | Specify public build/run contracts; bundle compiler Wasm and provide Core subpath, types, and CLI | Public exports, dependency separation from ordinary entry, supported ABIs, compiler versions/checksums and size, first-use and failure tests |
| 3: Applied routes | Validate existing SVG, math, and editor features with representative examples; test distribution | Packed packages, rendered output, supported OS validation |
| 3: Website | P0 bilingual entry and current-spec alignment; P1 representative generation, Playground prototype, and migration decision | Bilingual pages, executable examples, links/layout/language switching, browser measurements and cancellation tests, selected scope and deferral reasons |
| 4: Release candidate | Freeze grammar, APIs and validation examples; verify v0.3 candidate | Pinned commit, versions/checksums, release notes, Stage 2/3 equality, successful CI |
| 5: Release decision | Check required criteria and known limitations, then publish experimental v0.3 | Reproducibility from the pinned version, installation and acquisition instructions, implementation/specification agreement |
| 6: After release | Correct setup instructions, documentation and bugs; patch release if needed | Change history and validation results |

Release notes describe completed P1/P2 scope. Unfinished extensions do not become
additional P0 release conditions. If P0 fails, reassess scope; an experimental
label alone does not satisfy the criteria.

## Release checklist

- [x] Specify and test document Morphion correspondence, conversions, and undefined operations
- [x] Pin validation sources, commands and outputs to a commit
- [x] Pass `pnpm run build`, `pnpm test`, `pnpm run lint`, and `pnpm test:web-page`
- [x] Verify Stage 2/3 byte equality with `pnpm bootstrap:verify`
- [x] Obtain the same validation HTML on Windows/macOS/Linux with Node.js 22/24
- [x] Pack release packages and run validation examples from a separate empty project
- [x] Implement literate public APIs, types, and error contracts; run build→run→HTML without internal relative imports or checkout dependencies
- [x] Document compiler provisioning, supported ABIs, and network/Rust requirements; verify uncached first use
- [x] Pin instructions for compiler Wasm, checksums, source, and execution host
- [x] Provide general-audience Japanese/English website entry pages, examples, and setup links; recheck environments, dependencies, and limitations against README/specifications. Recorded in `matralang/website` commits `66970b3` and `aaab33a`, with `npm ci`, `npm test`, `npm run build`, and browser checks
- [x] Validate the Playground's current v0.3 scope in browsers and identify unavailable features and alternatives. Adopt HTML mode; defer full migration of SVG, Math, and JavaScript modules; record measurements and scope above
- [x] Pack Graphics, Math, and Compute Engine and run representative SVG, MathJSON, Content MathML, and evaluation examples from a temporary consumer; record the local macOS/Node.js 24 result
- [x] Verify Graphics, Math, Compute Engine, and editor tests and packed representative examples on Windows/macOS/Linux with Node.js 22/24. All six jobs passed on commit `1578bd1` in [run 40974296046](https://github.com/matralang/matra/actions/runs/40974296046). SVG browser display was checked on macOS; Content MathML visual rendering and interactive VS Code host testing remain explicitly unverified
- [x] Verify the Core browser entrypoint and packed literate distribution in remote CI across Windows/macOS/Linux and Node.js 22/24. All six jobs passed on commit `6b78dd4` in [run 40969391013](https://github.com/matralang/matra/actions/runs/40969391013)
- [x] Do not describe standard JS modules, npm/Python integration or general `.jsonm` as implemented

The existing [portable CI](https://github.com/matralang/matra/actions/runs/40418928782)
passed at the baseline commit. This does not validate the example HTML, all
packages, or published artifacts. The added web-page CI covers dependency
installation, HTML generation and verification on three OSes with Node.js 22/24.
Adding CI configuration is separate from observing its successful remote run.
