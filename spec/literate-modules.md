# Multilingual literate programming in Markdown (design proposal)

[English](./literate-modules.md) | [日本語](./literate-modules.ja.md) | [Index](./README.md)

## Status and scope

This document separates the initial implementation contract from future design proposals.
It is not a formal grammar specification. The implemented scope is the explicit entry, `.js.part`,
relative imports between `.js` modules fenced in the Markdown document, preinstalled npm
dependencies, and `.py` modules executed with Pyodide.
It supplements the [common runtime roadmap](./portable-runtime.md).

The scope is loading Markdown documents containing ordinary Matra Programs, module resolution,
language interoperation, and developer tooling. Changes to Matra compiler source grammar are out of scope.
The dedicated CLI and FrontMatter configuration are additive to Matra source,
compiler ABI, AST/data models, and parsers. The literate host API and CLI move
from caller-supplied entry/value selections to document FrontMatter as their
source of truth.
The [grammar specification](./grammar.md) and existing compiler source bootstrap contracts remain intact.
Questions outside the initial contract remain for later stages.

## Initial implementation contract

This is host interoperation for ordinary Matra Programs, not a change to Matra or compiler source
grammar. It uses existing member/call syntax, document generation, and the host value ABI.

```text
pnpm literate -- build ROOT DOCUMENT.md OUTPUT.json
pnpm literate -- run ROOT OUTPUT.json
```

The YAML FrontMatter at the start of the document specifies `matra.entry` and
`matra.values`. The entry is one `.matra` virtual file; values are a list of
`.js.part`, `.js`, or `.py` paths. Standard JavaScript ESM modules may expose named exports
or a default export alone. Python modules expose names listed in `__all__`.
Only modules selected by `matra.values` are exposed to Matra.
Fenced modules reached by relative imports are included as dependencies but are not
exposed under Matra names unless selected separately.
Unselected blocks are never initialized or executed. The build API and CLI
receive the document's runtime name/path only; entry and value selection comes
from the document. Missing FrontMatter, invalid YAML, or missing/invalid
configuration produces a diagnostic. There is no implicit import or physical
file lookup. `ROOT` and physical paths follow the
[portable runtime path contract](./portable-runtime.md).
Build produces a versioned JSON bundle containing Wasm, selected blocks, required module dependency
sources, and source locations.
Run writes the document data model as one JSON line to stdout; non-JSON document results such as
functions are errors.
The [executable sample](../crates/matra-seed/examples/literate-values.md) produces a document containing
the total `60`. Run regressions with `node --test crates/matra-seed/tests/literate-runtime.test.mjs`.

### Virtual files and formats

- FrontMatter appears at the start of the document and configures `entry` and
  optional `values` under a `matra` mapping. `entry` is a required string;
  `values` is an optional list of strings. Other FrontMatter fields are unused
  by this runtime. Parse FrontMatter as YAML and reject invalid syntax or types.
  Do not register fences inside FrontMatter strings; scan only the body after its closing delimiter.
- Fences open with zero to three spaces and at least three backticks or tildes. Closing delimiters
  use the same character, at least the opening length, followed only by spaces/tabs.
  CRLF is normalized to LF. Body line numbers are retained; unclosed fences are errors.
  Examples nested inside an outer fence are not scanned again as virtual files.
- The entire trimmed info string is a single filename. Language labels without an extension are
  explanatory. Paths use `/`; components are ASCII identifiers optionally followed by dot suffixes.
  Reject `.`, `..`, empty components, absolute paths, backslashes, and queries.
  Paths are case-sensitive, but case-only duplicates are also rejected.
- Registration rejects duplicate paths across all named fences. `.js`, `.js.part`, and `.py` are distinct formats.
  A `.js.part` public name is its path without the suffix; named exports from `.js` map to the module path
  plus the export name; a default-only export maps to the module path without the suffix. A module cannot
  mix default and named exports. Collisions among actual public names, including parent/child names, are errors.
- Python names from `__all__` map to the Python module path plus the export name.
- Only `.matra` entries and `.js.part`, `.js`, or `.py` values can be selected. Other formats and `?values`
  headers are diagnosed as unsupported, never inferred from the body.
- A `.js` fence may use static ESM imports/re-exports to relative `.js` fences in the same document.
  Specifiers must start with `./` or `../`, end in `.js`, and resolve to a registered fence.
  Bare package specifiers may import/re-export packages listed by name in
  `matra.javascript.packages` and installed under the selected document's dependency store.
  Do not generate or modify a project-root `node_modules`. Reject direct Node builtin imports, package import maps,
  dynamic `import()`, import attributes, top-level await, and cyclic dependencies. Imported modules
  need not also be listed in `matra.values`.
  A public root colliding with a Matra binding uses the existing duplicate-binding diagnostic.
- A `.py` fence may import other `.py` fences in the same document and Python's standard library.
  Resolve fenced modules using Python import names (path `/` becomes `.`) and include reachable
  dependencies in the bundle. Third-party packages are listed by name in `matra.python.packages`.
  The installer resolves compatible versions and records them in
  `.matra/deps/<document-key>/python/matra.python.lock.json`. The lock format is
  `matra-python-wheels-1` and binds the package set to the exact bundled Pyodide version.
  Entries contain the canonical package name, version, store-relative
  wheel path, and SHA-256. Only `py3-none-any` wheels are accepted; wheel contents are limited to
  purelib files, and every declared dependency must also be locked. Build validates hashes and
  metadata without executing package code. The bundle stores wheel references and hashes, not wheel
  bytes; run rechecks hashes and installs into its fresh runtime without network access. Build/run do
  not resolve packages through PyPI or use `micropip`. Each selected module must declare `__all__` as a literal
  list/tuple of string export names. Reject missing/invalid exports, cycles, and dynamic imports.
  For example, the front matter may contain `javascript: { packages: ["lodash-es"] }` and
  `python: { packages: ["idna"] }`. The Python lock file has this shape:

  ```json
  {
    "format": "matra-python-wheels-1",
    "pyodide": "314.0.7",
    "packages": [{
      "name": "idna",
      "version": "3.10",
      "file": "wheels/idna-3.10-py3-none-any.whl",
      "sha256": "<64 lowercase hex characters>"
    }]
  }
  ```

- Python exports are limited to common data values and synchronous functions. Copy `None`, booleans,
  safe-range integers, finite floats, strings, dense lists, and string-key dictionaries at each
  boundary. Reject class instances, tuples, sets, bytes, cycles, awaitables, and async functions.
- A `.js.part` body is syntax-checked as one parenthesized JavaScript expression in strict mode.
  Object/function/arrow expressions, newlines, and JavaScript comments are accepted.
  Import/export declarations, multiple statements, and trailing semicolons are rejected without fallback.

### Registration, build, and execution

Registration validates names, collisions, and selection. Build syntax-checks selected `.js.part`
expressions and `.js` modules/dependencies, validates imports, parses Python syntax/import dependencies
using Pyodide, and compiles Matra to Wasm; it does not execute document code. At runtime, selected `.js.part` values initialize in ascending ASCII path order,
then selected ESM modules initialize through the standard Node.js loader before the Matra entry runs.
ESM dependency ordering follows the standard loader, and each module initializes once per run.
Bare packages resolve from `.matra/deps/<document-key>/javascript/node_modules` under
`runLiterate`'s `moduleRoot` (default: `process.cwd()`).
The CLI passes its `ROOT`. Resolve packages and their transitive dependencies with Node.js's standard
loader; build does not install or execute them.
Selected Python modules execute in a fresh Pyodide runtime on each run. Include Pyodide and its standard
library in the npm distribution so execution does not download the interpreter. Build reads local wheels
under `moduleRoot` (default: `process.cwd()`); pass the same root to `runLiterate`, or use the CLI's
`ROOT`. Execution never contacts PyPI. Python imports and
module top-level code run at runtime; function bodies run only when called. Python and JavaScript module
state is not shared across runs. Pyodide is not a sandbox and Python can access host capabilities;
execute trusted documents only.
Function bodies execute only when called. `.js.part` expressions retain their fresh VM context.
Standard `.js` modules execute in the Node.js process and are not isolated from host globals or permissions.
Restricting static imports is not a sandbox and does not prevent module code from accessing `process` or other
host capabilities. Module top-level effects run on each run; changes to process globals may persist across runs.
Execute trusted documents only. No OS sandbox or timeout is guaranteed.
The initial implementation offers Wasm execution only, not a second interpreter mode.
Future modes must share these initialization/call semantics without build-time evaluation.

### Dependency preparation

Declare unversioned package names in `matra.javascript.packages` and `matra.python.packages`.
Run `matra deps install npm DOCUMENT` or `matra deps install python DOCUMENT` to prepare one
ecosystem at a time. The first install resolves compatible versions automatically. npm maintains
a generated manifest and lock per document. Python uses the host's Python 3/pip to download wheels
for the bundled Pyodide Python version, restricted to binary `py3-none-any` wheels.
`MATRA_PYTHON` may select the executable; otherwise the CLI uses `python3` (or `python` on Windows).

Generated files live under `.matra/deps/<document-key>/npm/` or `python/`. Python's lock records
resolved versions, metadata, and SHA-256 values. Install honors existing locks; `matra deps update
npm DOCUMENT` or `matra deps update python DOCUMENT` explicitly resolves versions again.
The operation does not execute wheel code. It uses Matra Command's explicit execution plan,
requests network access, and prompts before running; use `--yes` for non-interactive confirmation.
npm lifecycle scripts are disabled. Install operations are per-ecosystem and are not transactional.

`matra build` and `runLiterate` never install or resolve dependencies. Prepare them explicitly
before execution, and pass the same project root to build and run when using the library API.

### Value boundary and diagnostics

Across `.js.part`, `.js`, and `.py` boundaries, recursively copy `null`, booleans, finite numbers, strings, dense arrays, and plain objects with own
enumerable string-keyed data properties. JavaScript-to-Matra values may also contain functions.
Arguments passed from Matra are copied; JavaScript mutations do not update Matra data.
Return values are copied too. Aliasing is not preserved. Reject cycles, accessors, symbol keys,
non-enumerable properties, sparse arrays, custom prototypes, `undefined`, BigInt, non-finite numbers,
and Promises/thenables. Python integers are limited to `-(2^53-1)` through `2^53-1`; reject Python tuples,
sets, bytes, class instances, async functions, and awaitables. Document nodes can currently cross as plain data; there is no special conversion
for math, binary data, or class instances, nor dedicated first-class Matra-node conversion.
Each top-level standard module export must be a function or common data value; objects containing functions
are rejected. Matra function arguments and asynchronous work are unsupported.
JavaScript functions receive `undefined` as `this`; calling non-functions is an explicit existing host error.
Document output accepts only the data subset above, not functions.

The loader reports `LiterateError.code`, original document, virtual path, and body start line.
JavaScript causes/stacks retain original line/column locations. Matra compile diagnostics map to
original document lines. Matra runtime errors identify the entry block (expression-level source maps
are deferred). Duplicate, unsupported, missing, syntax, initialization, call, and boundary errors
must never become successful output. This section takes precedence over later proposals for the initial release.

## v0.3 public API and distribution contract

This section defines the v0.3 contract. Subpath and distribution implementations
are in the repository; this does not mean they have been published to npm.
Rather than adding an npm package in v0.3, the experimental Node.js subpath
`@matra/core/experimental/literate` will expose `buildLiterate`, `runLiterate`,
`LiterateError`, and corresponding types. Keep Node-specific execution and
compiler provisioning separate from the ordinary Core entry, with a future
standalone package planned. Its name and extraction schedule are undecided;
provide migration instructions when extracting it. Importing `@matra/core`
must not load the literate host or compiler Wasm, or introduce new dependencies
on Node.js-specific modules. The HTML renderer does not gain execution features.
The CLI provides `matra-literate build ROOT DOCUMENT.md OUTPUT.json` and
`matra-literate run ROOT OUTPUT.json`.
Standard JavaScript ESM fences in Markdown, relative imports within the same
document, bare imports of preinstalled npm packages, and Python `.py` modules
through Pyodide are supported experimentally. Python modules are limited to the
standard library. Browser execution and automatic npm/Python package installation
are outside this API's scope.

This is a documented and tested public API, but stable-API compatibility is not
guaranteed. Provide migration instructions for changes or moves. The unpublished
old path `@matra/core/literate` is not exported and has no compatibility alias.
The experimental status applies only to the literate API and distribution
approach, not to ordinary Core APIs.

### Functions and values

| API | Input | Successful result | Does not perform |
| --- | --- | --- | --- |
| `buildLiterate(markdown, options?)` | Markdown string; optional `options.document` name and `moduleRoot` | Promise of an executable bundle | Execution of document JavaScript/Python code or Matra programs; network package resolution; HTML generation |
| `runLiterate(bundle, options?)` | Executable bundle with a supported format and ABI; optional `globals` and `moduleRoot` | Promise of a value in the document data subset | Recompilation; network access; HTML generation or file output |

`options.document` is a diagnostic name, defaulting to `<markdown>`, not an
instruction to read a file. FrontMatter is the source of truth for entry and
values; caller overrides are rejected. Bundle the matching compiler Wasm so
ordinary use does not require compiler path or acquisition configuration.
`moduleRoot` is the project directory used to resolve the per-document dependency stores under
`.matra/deps/`; it defaults to `process.cwd()`. The document key is the lowercase SHA-256 of its
project-relative path after converting backslashes to `/`. Prepare dependencies there in advance.
Builds and runs do not download or modify project dependencies; Python wheels are installed only
into the fresh in-memory Pyodide runtime. Bundles store wheel paths and hashes, not wheel bytes.

Build returns a versioned bundle that can be saved and restored as JSON.
It contains Wasm, selected JavaScript sources, and source locations; it does not
hide sources or promise compatibility across arbitrary versions. Document the
supported bundle formats and compiler/host ABIs, and reject unsupported
combinations before execution. A bundle can be run repeatedly, with fresh
JavaScript contexts and values each time. Context isolation does not guarantee
identical results for arbitrary user code.
The current format is `matra-literate-1`, with ABI `matra-value-1`, recorded in
`format` and `abi`. Rebuild older internal bundles without an ABI field. Public
types are `LiterateBuildOptions`, `LiterateBlock`, and `LiterateBundle`.

Run returns a value satisfying the existing boundary, not an AST-specific type.
Convert document nodes using Core's `staticValueToAST()` where needed by a
renderer. Ordinary examples pass bundles in memory without requiring
intermediate files, JSON serialization round trips, or child processes.

```js
import { staticValueToAST } from "@matra/core"
import { buildLiterate, runLiterate } from "@matra/core/experimental/literate"
import { toHTML } from "@matra/html"

const bundle = await buildLiterate(markdown, { document: "web-page.md" })
const value = await runLiterate(bundle)
const ast = staticValueToAST(value)
const html = toHTML(ast)
```

The subpath above is implemented in the repository; packed distribution tests
use the same imports outside the checkout. Installation examples must not use
internal relative imports. The CLI is a thin
entry point over the same build/run implementation, without separate evaluation
rules.

### Compiler acquisition, regeneration, and provenance

Users acquire an exact published version of `@matra/core`. The compiler Wasm
and manifest are included in `dist/literate/`; they are not downloaded
separately. Record the release Git tag and commit SHA, package version, bundled
manifest, and npm registry tarball integrity for each release.

To regenerate the compiler from a checkout, use a clean checkout of the release
tag and its lockfile. The Rust toolchain is pinned by
[`rust-toolchain.toml`](../rust-toolchain.toml).

```text
pnpm install --frozen-lockfile
rustup toolchain install 1.97.1 --profile minimal
pnpm --filter @matra/core run build
pnpm test:literate:package
```

The compiler source is the `compiler.matra` fence in
[`compiler.md`](../crates/matra-seed/examples/compiler.md).
[`build-compiler.mjs`](../packages/core/scripts/build-compiler.mjs) generates
Stage 2/3 with the Rust seed compiler, asserts byte equality, and writes
`dist/literate/compiler.wasm` and `compiler.json`. The manifest's
`sourceSha256` hashes the extracted fence as UTF-8; `sha256` hashes the Wasm
bytes. It also records the package version, ABI, byte size, and Stage equality.
The execution host and CLI source are pinned by the release commit under
[`packages/core/src/literate/`](../packages/core/src/literate/);
`compiler.mjs` verifies the Wasm checksum, ABI, and exports at load time.

`pnpm test:literate:package` installs the packed contents in a temporary
project outside the checkout. It verifies Rust/bootstrap-cache/compiler-download
free execution and rejects missing, corrupt, and ABI-incompatible Wasm. Do not
add the generated Wasm to Git. Record the manifest alongside the Git commit,
package version, and npm tarball integrity so the acquired artifact, source,
host, and checksum remain traceable.

### Failures, dependencies, and publication gates

- Configuration, compilation, execution, and boundary failures reject the
  Promise. Preserve `LiterateError.code`, document/virtual path/location, and
  available causes; make compiler acquisition, loading, and ABI failures
  distinguishable too. Exact message and stack strings are not compatibility
  contracts.
  Errors have `document`, `path`, and `line`. Bundled compiler loading, checksum,
  and ABI failures use `COMPILER_LOAD` with a cause; unsupported bundles use
  `INVALID_BUNDLE`.
- APIs return results without ordinary progress output on stdout. CLI run stdout
  contains only result JSON; diagnostics go to stderr and failures use nonzero
  exit status. Build does not execute code from the document.
- Validate Node.js 22/24 on Windows/macOS/Linux. There is no OS sandbox or timeout
  guarantee: execute trusted documents/bundles only. Installation does not execute
  document code.
- Bundle verified compiler Wasm in the `@matra/core` distribution and record its
  version, checksum, and supported ABI. After installation, build/run must not
  download another compiler or require user-side Rust or checkout-local
  bootstrap/cache machinery. Distribution preparation and validation may use
  Rust and bootstrap. Check the added package size. Missing, corrupt, or
  ABI-incompatible Wasm must fail explicitly, without implicit download or
  local-build fallbacks.
- Verify public APIs, types, runtime dependencies, and compiler artifacts from
  packed distributions. Install in an empty project outside the checkout and
  exercise build→run→HTML using only public imports. Test uncached first use,
  supported OS/Node versions, unsupported bundles, and compiler provisioning
  failures.
- Publish as experimental official v0.x APIs, documenting breaking changes and
  migration steps in release notes. Creating a package alone does not complete
  publication; distribution validation blocks the release.

Preserve correctness, value boundaries, diagnostics, and bootstrap verification
of existing P0 routes first. Then establish bundled Wasm generation/verification,
provide subpath exports and types, connect the CLI, and migrate examples to public imports. This completes the v0.3
user-facing route and takes precedence over P1/P2 feature expansion.

## Core policy

> Let people write as briefly as possible when they want brevity, and explicitly when they want precision.

- Use Markdown as the entry point for explanations and code.
- Treat named code blocks as virtual files, making use of paths and extensions.
- Keep JavaScript as JavaScript. Do not introduce a JavaScript dialect inside Matra
  as a way to achieve npm compatibility.
- Treat JavaScript expressions as values, exposing datasets, objects, arrays, and numbers as well as functions.
- Give the value form a corresponding explicit export form with the same public name and value usage contract.
- Connect languages through explicitly exposed values rather than implicitly sharing all variables.
- Connect execution through dependencies, without unnecessarily depending on the narrative order of blocks.

## Named fences as virtual files

The following proposed example uses a regular JavaScript module.

````markdown
```analytics.js
export function total(values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```

```main.matra
let result = analytics.total([10, 20, 30])
p { result }
```
````

`analytics` is not a reserved word: it comes from the path `analytics.js` without its extension.
`total` comes from the JavaScript named export. Neither depends on the Markdown filename.
Here, `main.matra` illustrates a possible entry point, not a finalized automatic execution rule.
The intended Matra result is a document node containing `60`.

The design also allows a default export when splitting files by functionality.

````markdown
```analytics/total.js
export default function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```

```main.matra
let result = analytics.total([10, 20, 30])
p { result }
```
````

| Virtual file | Exposed value | Reference in Matra |
| --- | --- | --- |
| `analytics.js` | Named export `total` | `analytics.total(...)` |
| `analytics/total.js` | Default export | `analytics.total(...)` |

The latter maps path components to namespaces and assigns the default export to the leaf name.
This is an interoperation rule for Matra, not a change to standard JavaScript import semantics.
Multiple definitions producing the same name are errors, not order-dependent overwrites or implicit merges.
For example, placing both definitions above in the same resolution scope causes an `analytics.total` collision.

The examples illustrate directly referencing `analytics` from the same document.
The actual visibility scope and whether explicit imports are an option remain undecided.
The goal is to retain paths and public contracts when extracting blocks into physical files,
but lookup rules and precedence between virtual and physical files must be specified before implementation.

## Explicit form and shorthands

JavaScript blocks have an explicit module form and a value form exposing the value of one expression.
The value form treats the entire body as a value definition, much as JSON represents data,
not as a series of module declarations.
A function is one kind of value; this is not a shorthand mechanism specifically for functions.
The parameter-header form is shorthand for defining a function value returning the expression.

Select the form by virtual filename rather than guessing from the body.

| Filename | Body interpretation |
| --- | --- |
| `foo.js` | Standard JavaScript module |
| `foo.js.part` | Value represented by one JavaScript expression |
| `foo.js.part?values` | Function value taking `values` and returning the body expression |

`.js.part` denotes an expression fragment; remove the entire suffix when constructing public names.
For example, `analytics/total.js.part` exposes `analytics.total`.
Do not adopt `.partial.js` as an alias. Ordinary `.js` does not implicitly switch to the value form,
and `.js.part` does not accept import/export declarations as a module.
If the two forms produce the same public name, apply the collision rule described above.

The following function examples all expose the same function as `analytics.total`.
The value form and parameter headers are Markdown loader rules, not standard JavaScript module syntax.
They require expansion to an explicit export form when extracted into ordinary `.js` files.

### 1. Explicit form: a standard JavaScript module

````markdown
```analytics/total.js
export default function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```
````

The module form allows ordinary imports, named exports, and multiple declarations.
How a mixture of default and named exports is exposed to Matra remains undecided.

### 2. Value form: one JavaScript expression

````markdown
```analytics/total.js.part
function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```
````

Interpret the entire body as one JavaScript expression and expose its evaluated value at the corresponding path.
The example above defines a function expression as a value; arrow functions follow the same model.

````markdown
```analytics/total.js.part
values => values.reduce((sum, value) => sum + value, 0)
```
````

A standalone anonymous `function (values) { ... }` is not a valid statement in a standard JavaScript module,
but it is a valid function expression in the value form.
The explicit counterpart can be expressed as `export default <expression>`.
This describes corresponding public contracts, not interpreting the value-form body as a module.

The design supports datasets and numbers as well as functions.

````markdown
```datasets/sales.js.part
[
  { label: "A", amount: 10 },
  { label: "B", amount: 20 }
]
```

```settings.js.part
{ title: "Sales", scale: 2 }
```

```constants/taxRate.js.part
0.1
```

```main.matra
let rows = datasets.sales
p { settings.title }
for (row in rows) {
  p { row.amount }
}
p { constants.taxRate }
```
````

An object's `{ ... }` is an expression, not a statement block.
The value form covers arrays, objects, numbers, strings, booleans, null, and similar values;
only function values are callable.
The intended experience resembles JSON, but does not use a JSON parser or serialize values to JSON.
JavaScript expressions can have side effects such as function calls, so they do not guarantee static-data safety.
Specify evaluation timing and frequency, sharing and mutability, and names available to expressions before implementation.
Distinguish module and value forms by filename as described above.
Do not retry a different form as a fallback after a syntax error.

### 3. Parameter-header and expression shorthand

````markdown
```analytics/total.js.part?values
values.reduce((sum, value) => sum + value, 0)
```
````

- `analytics/total.js.part` is the virtual file path.
- `?values` declares the function parameter; it is neither a URL query value nor a call argument.
- The body is one JavaScript expression whose evaluation supplies the return value.
- `?values` is excluded from module identity and public names.

This example expands to the explicit `export default function (values) { return ... }` form.
The body is not a function body, so this form does not accept a `return` statement or multiple statements.
Use a function expression or explicit module when multiple statements are needed.
Syntax for multiple parameters, no parameters, defaults, destructuring, rest parameters, and async remains undecided.
Specify handling of object expressions, line breaks, comments, and trailing semicolons before implementation.

## Common runtime and language responsibilities

```text
Markdown
  └─ Collect named blocks and resolve modules
       ├─ Matra → compiler → Wasm
       ├─ JavaScript → JavaScript module
       └─ Python → Python runtime (future)
                    ↕
             Common calling contract
```

The common runtime handles startup, dependencies, public function connections, and error propagation.
Compiling every language to Wasm is not required.
The Node.js host and existing
[provisional host value ABI](../crates/matra-seed/host/value-host.mjs) can provide a starting point,
but the existing ABI is not thereby guaranteed as a stable common protocol.
Decide on WASI and the Component Model separately.

JavaScript blocks can use preinstalled npm packages through standard imports. Python blocks use
Pyodide's standard library and explicitly hash-locked `py3-none-any` wheels. PyPI resolution, native
Python wheels, arbitrary npm packages and native addons, identical behavior on three OSes, and Web
operation are not guaranteed.

Define argument and result support for numbers, strings, arrays, objects, document nodes, mathematical
expressions, large integers, binary data, and function references, including copy versus sharing semantics.
The contract must also cover exceptions, asynchronous execution, timeouts, cancellation,
module initialization, and cyclic dependencies.
Do not assume that current synchronous host calls automatically await JavaScript Promises.

### Initial common interface proposal (semantic contract)

This is the semantic contract proposal for common JavaScript/Python behavior beyond Node.js ESM.
The MatraJSON wire encoding is not implemented; Python module execution uses Pyodide and implements
part of this value boundary. Define language-specific module
loaders separately from the meaning of cross-language values and calls. The initial transport is a direct connection within a Node.js host, with Matra continuing
to execute through its existing Wasm approach. JavaScript and Python themselves need not be compiled to Wasm.
Separate processes, WASI, and the Component Model are out of scope for this first proposal.

#### Public names and module lifecycle

- Explicitly select modules and exports visible to Matra. Do not add loader-specific import syntax or implicit
  publication of every module to Matra grammar. The host profile defines module/export-to-Matra name mapping
  and rejects collisions.
- Module dependencies are explicit. Resolve and initialize only dependencies reachable from the selected entry,
  initializing each dependency before its dependent. Reject dependency cycles in the initial version.
- The host determines the order of independent modules using a reproducible rule. Initialize each module at
  most once in a run. Retry after a failed run, module caching, and side effects/state across runs must be
  stated separately in the loader contract.
- Build/name registration does not execute user code. Initialize modules at run time, and do not treat import,
  export, or initialization failures as success. Preserve the visibility and failure-propagation rules when
  using the JavaScript ESM loader or Python import system.

#### Common values and calls

- Initial common data values are null, booleans, finite IEEE 754 binary64 numbers, Unicode strings, dense arrays,
  and objects with string keys. Accept Python integers only in the range `-(2^53-1)` through `2^53-1`;
  report out-of-range integers as conversion errors rather than silently rounding. Reject numbers that cannot
  be converted to finite binary64 on either side.
- Recursively copy arrays and objects at every boundary. Do not guarantee shared identity or propagate host-side
  mutations. Reject values that cannot be losslessly represented in the common form, including cycles, sparse
  arrays, non-string map keys, accessors, and custom class instances. Do not preserve aliases; copy each occurrence
  independently.
- When exchanging Matra nodes and JavaScript/Python data values as JSON, represent a Matra node as an ordinary
  MatraJSON tuple and a foreign data value as a one-element array `[value]`. A MatraJSON node has three elements
  (`[tag, props, children]`), while a data-value envelope always has one, so they are distinguishable at the
  top level. Examples:

  ```text
  ["foo", {"bar": "5"}, ["hoge", "piyo"]]
  ["5"]
  [5]
  [true]
  [null]
  [[8]]
  [{"a": 3}]
  [["foo", {"bar": "5"}, ["hoge", "piyo"]]]
  ```

  The last example is a JavaScript array with the same shape as a MatraJSON node; the contents of the one-element
  envelope are not recursively interpreted as MatraJSON. This avoids inferring whether ordinary JSON arrays or
  objects are Matra nodes from their shape. Foreign data values use the JSON-compatible subset (null, booleans,
  finite numbers, strings, arrays, and string-keyed objects); reject cycles, non-finite numbers, duplicate object
  keys, and host values that cannot be represented. Matra nodes follow the existing MatraJSON rules.
- On the JavaScript/Python side, receive a Matra node as a JSON-equivalent MatraJSON tuple and parse it as needed.
  To return a Matra node, use an explicit node constructor/API that produces the tuple. To return an ordinary
  JavaScript/Python value, use the host-value envelope even if its array has the same shape as a node.
  Thus a tag acts as a Matra-node constructor, while JSON primitives map directly to Matra values.
- This encoding defines an exchange profile for the cross-language API; it does not change the existing
  MatraJSON data model. Identify the profile version in the API/bundle contract rather than repeating it in
  each node or value.
- Expose a foreign function as an opaque callable associated with a run session and a selected export; Matra may
  call it synchronously. Arguments and results are limited to common data values. The initial version does not
  support functions embedded in data objects or passing Matra functions as foreign callbacks.
  A callable is not a JSON-serializable data value; represent it only through an opaque handle and call operation
  valid within its session.
- Asynchronous module initialization, asynchronous calls such as Promise/await, timeouts, and cancellation are
  not part of the initial common contract. If a Promise, awaitable, or other asynchronous value is returned at
  a data boundary or from a synchronous call, report an explicit unsupported/conversion error.
- This value/call contract does not automatically grant filesystem, network, process, or other host capabilities.
  Each host/runtime documents actual permissions and safety separately. An in-process Node.js connection does
  not provide an OS sandbox.

#### Errors and compatibility

Failures distinguish at least `MODULE_RESOLUTION`, `MODULE_INITIALIZATION`, `FOREIGN_CALL`,
`VALUE_CONVERSION`, and `UNSUPPORTED_FEATURE`. An error record has a code and message, and includes module/export
names and source location when available. Keep the foreign exception/cause accessible to the host; do not
implicitly return it to Matra as a common data value. Message text and host-specific stack formats are not shared.

This is an initial semantic proposal. The dependency declaration format, deterministic ordering for independent
modules, module cache/state across runs, resource limits, and package resolution for JavaScript and Python remain
to be decided. Treating Matra nodes as first-class runtime values in Matra programs also requires a separate
grammar/runtime contract; this wire encoding alone does not implement that behavior. It does not change the
existing `.js.part` contract or `matra-value-1` ABI; Node.js ESM support is an experimental host API addition.

## Compilation and evaluation semantics

Compilation and interpretation must not change evaluation order or side-effect semantics for the same program.
Compilation performs parsing, validation, and code generation; it does not mean executing user
expressions or module initialization at build time.
These evaluations happen at runtime.

Distinguish three phases:

1. Name registration: collect virtual file paths and public names without executing user code in the bodies.
2. Value initialization: evaluate expressions to create data or function values, or initialize modules.
   Side effects can occur in this phase.
3. Function invocation: execute the body of an exposed function.

JavaScript function declaration hoisting does not mean evaluating all code at the start.
A function declaration can be called before its declaration in the same scope, but its body runs on invocation.
For function expressions and arrow functions, also distinguish creating a function value from running its body.
Registering a name does not imply its value has been initialized.

The specific initialization order and frequency, dependencies and forward references,
cyclic dependencies, and state across reruns remain undecided.
Selecting compilation or interpretation must not implicitly switch these rules.

## Execution selection and developer experience

The presence of filename-based fences must not automatically execute all code in a document.
Distinguish explanatory examples from executable code and define entry points, dependencies,
duplicate paths, and initialization order.
Make permission approval and environment constraints explicit; neither virtual files nor Wasm is an OS sandbox.

Developer tooling should identify languages by extension and recognize parameter headers.
Ordinary Markdown tools may not automatically highlight `analytics/total.js.part?values` as JavaScript.
Connect completion, import resolution, type checking, formatting, and debugging to existing language tools.
Include shorthand parameters in completion and analysis.
Maintain mappings between original Markdown and generated modules rather than relying on fixed
offsets into generated code; map syntax and runtime errors to the original block's lines and columns.
Consider tooling for expanding shorthands and extracting physical files.

## Initial implementation status and verification

The initial Node.js contract is available experimentally. It includes `.js.part`,
standard ESM with same-document relative imports, preinstalled npm dependencies,
and Pyodide `.py` modules limited to the standard library. Python build analyzes
ASTs and import dependencies without executing document code; each run uses a fresh
Pyodide runtime. This does not promise non-Node hosts, a general sandbox, or
compatibility with arbitrary npm/Python packages.

Primary regression checks:

- `pnpm --filter @matra/core run build` generates compiler Wasm and verifies Stage 2/3 byte equality.
- `node --test packages/core/tests/literate.test.mjs` covers `.js.part`, ESM/npm, and Python syntax, imports, value boundaries, and execution.
- `node --test --test-concurrency=1 crates/matra-seed/tests/literate-runtime.test.mjs` checks shared runtime regressions from the seed host.
- `pnpm test:literate:package` verifies bundled Pyodide and execution from a packed Core installation outside the checkout.

Completion, type checking, formatting, debugging, and detailed source mapping to
the original document remain future work. Dedicated Matra-node wire conversion,
async interoperation, PyPI resolution, native Python wheels, and browser execution are also outside
the initial scope.
