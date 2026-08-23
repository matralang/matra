# Matra seed compiler

This directory contains the Rust seed compiler that compiles Matra Program to WebAssembly and
the bootstrap compiler written in Matra. The implementation is currently an experimental
bootstrap foundation and is not recommended as a production compiler.

## Status

- The Rust seed produces a reproducible stage-1 compiler Wasm artifact.
- Stage 1 compiles a limited subset of Matra Program to Wasm.
- Diagnostics use a 36-byte result ABI with source ranges and expected grammar kinds.
- Compiler artifacts use a content-addressed cache and a SHA-256 sidecar.
- Compiling the compiler itself with stage 1 is not supported yet.

The self-host check compiles the compiler source through stages 1, 2, and 3, then compares stages
2 and 3 byte for byte. It currently stops at `struct token` while producing stage 2, so the
command exits with status `1`.

```text
pnpm bootstrap:verify
```

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
- [`HANDOFF.ja.md`](HANDOFF.ja.md): exact continuation point and next implementation step
- [`../../spec/program.md`](../../spec/program.md): Program ABI draft

Generated Wasm and cache files belong under `target/` or an explicit output directory and are not
committed. The release workflow uploads the Wasm and checksum as a GitHub Actions artifact for a
`v*` tag or a manual dispatch.

## Maturity

The compiler is currently `experimental`. It can validate the restricted grammar, artifact
reproducibility, and host ABI, but it is not a production compiler for general input. Even after
self-hosting succeeds, production readiness requires fuzzing, resource limits, ABI versioning,
cross-platform reproducibility, and release provenance.
