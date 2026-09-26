# Matra seed compiler

This directory contains the Rust seed compiler that compiles unified Matra and legacy Matra Program to WebAssembly and
the bootstrap compiler written in Matra. The bootstrap foundation is complete, but the
compiler is not recommended for production use.

## Status

- The Rust seed produces a reproducible stage-1 compiler Wasm artifact.
- Stage 1 compiles a limited subset of Matra Program to Wasm.
- Diagnostics use a 36-byte result ABI with source ranges and expected grammar kinds.
- Compiler artifacts use a content-addressed cache and a SHA-256 sidecar.
- Stage 1 compiles the compiler source into stage 2, and stage 2 compiles it into stage 3.
- Stage 2 and stage 3 Wasm artifacts are byte-identical.

The self-host check compiles the compiler source through stages 1, 2, and 3, then compares stages
2 and 3 byte for byte. On success it reports each stage's SHA-256 checksum and elapsed time.

```text
pnpm bootstrap:verify
```

## Unified grammar

Rust seed supports the document and native compiler profiles of the [unified grammar](../../spec/unified-grammar.md).
The document profile executes string/number/boolean/null values, arrays, objects, members, calls, nodes,
`fn`, `return`, `if` / `else`, `for`, assignment, `while`, `do-until`, and `break` in Wasm.
Control constructs are expressions: if returns its selected block value, for returns iteration values as an array,
and while/do-until return null. Each node-body expression adds one child; `...expression` explicitly expands an array.
Parentheses in `let (x = value)`, `if (condition)`, and `for (item in items)` may be omitted under the specified rules.

```text
cargo run --manifest-path crates/matra-seed/Cargo.toml -- \
  crates/matra-seed/examples/document.matra /tmp/document.wasm
```

Run document Wasm with the supplied host:

```js
import { readFile } from "node:fs/promises"
import { instantiateUnified } from "./crates/matra-seed/host/unified-host.mjs"

const program = await instantiateUnified(await readFile("/tmp/document.wasm"))
console.log(program.run())
```

The Rust library exposes `compile_unified(source)`, `unified::parse(source)`, and
`unified::evaluate_static(&module)`. Static retrieval returns an `EvaluationRequired` error for
expressions requiring execution. Select a named Markdown fence with `--entry document.matra`.

`examples/compiler.md` now uses the `compiler.matra` fence; `module compiler` selects the native
profile. The Rust seed's common parser builds a syntax tree lowered to the existing typed linear-memory
ABI. The self-hosted compiler also parses document programs and emits Wasm using the provisional host ABI.
`bootstrap:verify` runs shared acceptance, rejection, and execution tests at every Stage.
Existing `.matra.program` fences retain their compatibility entry point. Migration affects the compiler
example, fence-reading hosts/tests, seed READMEs, and both unified specifications. Existing legacy
Program examples do not need bulk conversion.

## Commands

Compile a Markdown Program with the Rust seed:

```text
cargo run --manifest-path crates/matra-seed/Cargo.toml -- \
  INPUT.md OUTPUT.wasm --entry NAME.matra.program
```

Compile Matra source with the cached stage-1 compiler:

```text
pnpm bootstrap:compile -- INPUT.matra OUTPUT.wasm
```

Materialize the compiler Wasm and checksum for release automation:

```text
pnpm bootstrap:artifact -- dist/matra-bootstrap.wasm
```

Run the related tests and repository checks:

```text
pnpm run test:seed
pnpm run lint
```

## Layout

- [`src/`](src/): Rust seed compiler
- [`examples/compiler.md`](examples/compiler.md): bootstrap compiler source written in Matra
- [`host/`](host/): Node.js host, cache, artifact, and self-host verification commands
- [`tests/`](tests/): integration tests for the Rust seed and bootstrap compiler
- [`HANDOFF.ja.md`](HANDOFF.ja.md): archived investigation history through bootstrap completion
- [`../../spec/program.md`](../../spec/program.md): Program ABI draft

Generated Wasm and cache files belong under `target/` or an explicit output directory and are not
committed. The release workflow uploads the Wasm and checksum as a GitHub Actions artifact for a
`v*` tag or a manual dispatch.

## Maturity

The compiler is currently `experimental`. It can validate the restricted grammar, artifact
reproducibility, and host ABI, but it is not a production compiler for general input. Production
readiness additionally requires fuzzing, resource limits, ABI versioning, cross-platform
reproducibility, and release provenance.
