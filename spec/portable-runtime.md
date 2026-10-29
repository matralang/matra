# Matra portability policy and common runtime roadmap

[English](./portable-runtime.md) | [日本語](./portable-runtime.ja.md)

## Status

This document guides design and implementation and defines the small working v0.3 subset, not formal support.
The minimal host API below is implemented; broader APIs, package formats, and task definitions remain undecided.
It changes neither general Matra Program nor compiler source grammar, existing ABIs, or public APIs.
The [grammar specification](./grammar.md) remains authoritative for syntax and evaluation.

## Small working v0.3 subset

The v0.3 milestone is to build and run the same Matra/Wasm project unchanged on
Windows, macOS, and Linux using a host running on Node.js.
It excludes standalone runtime distribution, package management, a general task engine, and npm/Python integration.
This is an experimental minimal contract; completion of the whole system remains on the roadmap below.

### Running the sample

Prepare a repository checkout, pnpm (as specified by the root `packageManager`), Node.js 22 or 24,
and the Rust toolchain specified in `rust-toolchain.toml`.
This entry point and its tests use only Node.js built-in modules; a workspace-wide build is unnecessary.
The first build needs the Rust seed; subsequent builds reuse the existing bootstrap compiler cache.
This is not a standalone executable distribution procedure.

Install Rust with rustup. The repository's `rust-toolchain.toml` selects Rust 1.97.1, so the first
Rust command may download that toolchain. On Windows, use Visual Studio Installer to install the
"Desktop development with C++" workload, including the MSVC C++ build tools and a Windows SDK.
The Rust MSVC toolchain needs `link.exe` to build the native seed. After installing Rust or Visual
Studio, restart VS Code or open a new terminal so the environment is refreshed.
If `rustc` or `cargo` is not on `PATH`, `build` exits with status 1 and explains how to install the
Rust toolchain.

From the repository root, verify that Rust 1.97.1 is selected and run the portable test:

```text
rustc --version
cargo --version
pnpm test:portable
```

From the repository root, use the same commands on all three OSes:

```text
pnpm portable -- build crates/matra-seed/examples/portable main.matra main.wasm
pnpm portable -- run crates/matra-seed/examples/portable main.wasm
```

`build ROOT SOURCE OUTPUT` compiles source to Wasm with the Matra-written Stage 1 compiler.
`run ROOT WASM [ARGS...]` executes that Wasm connected to the common host API.
`ROOT` is a native path relative to the CLI's working directory; `SOURCE`, `OUTPUT`, and `WASM`
are logical paths relative to that root.
Program file APIs use the same root without changing the process working directory.
`ARGS` contains only arguments following the Wasm path, not Node.js or script paths.
CLI failures report to stderr with a nonzero exit status.

The [sample](../crates/matra-seed/examples/portable/main.matra) reads `input.txt`, uses Matra
expressions to prepend `Matra v0.3:` and one space, writes `output.txt`, and prints `Wrote output.txt`.
Its first argument can select another input file.
Git pins the input fixture to LF; generated files are ignored.

### Minimal common API

Explicitly inject the following `runtime` binding into document-profile Wasm.
Reuse existing member/call semantics and the host value ABI without adding grammar or Wasm imports.
Ordinary `instantiateMatra()` does not inject it automatically, preserving existing document execution.

| API | v0.3 contract |
| --- | --- |
| `runtime.version` | String `"0.3"` identifying this API subset |
| `runtime.args` | String array copied from the caller, iterable with `for` |
| `runtime.read_text(path)` | Read a regular file as UTF-8 and return a string; reject invalid UTF-8 |
| `runtime.write_text(path, text)` | Create or overwrite a file as UTF-8; return `null` |
| `runtime.print(text)` | Write text plus one LF to stdout; return `null` |

I/O is synchronous. Preserve line endings and UTF-8 BOMs as characters.
Reject non-string paths/text and lone surrogates rather than implicitly coercing values or substituting characters.
Writes do not create parent directories or guarantee atomicity or rollback on failure.
Stdout write failures also count as execution failures.

### Minimal path and error contract

- Paths must be nonempty, root-relative, `/`-separated, with each component specified in Unicode NFC.
  Match native filesystem NFD names through NFC normalization.
- Reject absolute paths, drive prefixes, backslashes, empty components, `.` and `..`,
  control characters, `<>:"|?*`, trailing dots/spaces, and Windows reserved device names.
- Match existing names through NFC and Unicode lowercase, rejecting case mismatches and collisions
  with the same comparison name. Complete emulation of OS-specific Unicode aliases is out of scope.
- The root must be an existing directory. Reject symlinks inside it (including Windows junctions),
  reads/writes of non-regular files, and writes with missing parent directories.
  Resolve the native root itself to a canonical path.

The Node.js implementation reports `PortableRuntimeError.code` values `INVALID_ARGUMENT`, `INVALID_PATH`,
`CASE_MISMATCH`, `SYMLINK`, `NOT_FOUND`, `NOT_DIRECTORY`, `NOT_FILE`,
`IS_DIRECTORY`, `ACCESS_DENIED`, `INVALID_UTF8`, and `IO_ERROR`.
Compiler diagnostics and Wasm validation/execution errors outside the host are also explicit CLI failures.
These checks support portability; they are not an OS security sandbox against concurrent filesystem
changes, hard links, or similar mechanisms. Use trusted, explicitly selected programs and projects.
This subset provides no APIs for networking, time, environment variables, or external CLIs.

### Validation and completion condition

```text
pnpm test:portable
pnpm example:web-page
pnpm test:web-page
pnpm bootstrap:verify
```

`test:portable` runs host API/error regressions and CLI build/run of the same sample.
`example:web-page` and `test:web-page` generate HTML from the validation document and verify
its output and JavaScript integration.
In addition to Stage 2/3 byte equality, `bootstrap:verify` checks reading, Matra processing,
file writing, arguments, and stdout for sample Wasm generated by each Stage's compiler.
The [CI workflow](../.github/workflows/portable-runtime.yml) runs these commands across
Windows, macOS, Linux, and Node.js 22/24. Only host setup varies.
Adding CI configuration does not establish verified three-OS operation:
all jobs for the target commit must pass to complete the v0.3 milestone.
These are validation environments, not a formal support matrix with minimum OS versions.

## Central goal and guarantee boundary

The intended guarantee for the first formally supported release is:

> A project built with Matra's common APIs and supported packages can resolve dependencies,
> start, build, and run on supported Windows, macOS, and Linux environments without
> changing its source or configuration.

Matra aims for usability similar to Node.js or Python, but prioritizes portability, including
dependencies, over arbitrary external CLI execution.
The same project includes its source, dependency definitions, lockfile, and startup/build definitions.
Installing the appropriate Matra distribution and preparing explicitly declared runtime inputs,
such as credentials, are separate prerequisites.

| Layer | Policy |
| --- | --- |
| Language and standard library | Provide the same semantics and behavior across the three OSes within the common specification |
| Packages | Use packages whose execution requirements and dependencies satisfy the common contract |
| Project management | Reproduce the environment from the same dependency definitions and lockfile |
| Startup and build | Define operations without OS-specific shell commands |
| External CLIs and OS-specific features | Separate explicit extensions from the common guarantee |
| Android and iOS | Initially target Web operation or partial features, not PC-equivalent guarantees |

Before formal support, a support matrix must identify minimum OS versions, CPU architectures,
execution engines and their versions, and distribution/installation methods.
An OS name alone does not promise support for every environment.
Web capabilities also need a separate matrix; unavailable features must be reported by
pre-execution checks or explicit errors.

Portability does not guarantee identical time, randomness, network responses, or bytes for every build artifact.
Validation covers common API semantics, reproducible dependency resolution, and deterministic sample results.
Build reproducibility needs a separate contract specifying inputs, toolchains, and environment conditions.

## Existing assets and their roles

- The [Rust seed and Matra compiler](../crates/matra-seed/README.md) provide Wasm generation and
  Stage 1/2/3 self-host verification. Stage 2/3 byte equality verifies the compiler;
  it does not prove project portability across the three OSes.
- The [standard grammar Wasm host](../crates/matra-seed/host/value-host.mjs) provides a provisional
  host value ABI. The [minimal Node.js host](../crates/matra-seed/host/node-runtime.mjs) adds v0.3 file I/O
  and related features on top of it, not a completed broad common runtime.
- [Matra Command](../packages/command/README.md) provides external process integration through execution
  plans and explicit authorization. Even `shell: false` does not guarantee an external program's
  availability or portability. Keep existing execution features and position them as extensions
  connecting to environment-specific operations.
  Capability declarations alone do not place child processes in an OS sandbox.
- [`loadMatra`](../packages/core/src/jsonmatra.ts) is a document loader using Node.js file APIs and
  module loading. Its role is distinct from common package loading and dependency resolution.
- The [bootstrap artifact workflow](../.github/workflows/bootstrap-artifact.yml) runs on Ubuntu.
  A separate portable runtime workflow performs v0.3 three-OS verification.
  Full common verification including dependency resolution remains future work.

Use Wasm as a strong candidate for the common execution format and align its surroundings through
common host APIs. Distinguish the development pnpm workspace from future Matra user-project package
management. Wasm alone does not make arbitrary packages or OS features portable.

## Four priority contracts

### 1. Common runtime and host APIs

Specify shared host capabilities, behavior, and errors across OSes.
Decide API names and ABIs before implementation.
At minimum, address the following differences rather than unconditionally inheriting OS defaults.

| Area | Decisions required |
| --- | --- |
| Files and paths | Logical/native path boundary, base directory, separators, absolute paths, parent traversal |
| File names | Case sensitivity, Unicode normalization, reserved/invalid names, collision and non-portable name detection |
| I/O | Text encoding and line endings, binary distinction, directory ordering, symlinks, permissions, error categories |
| Networking | Supported protocols, asynchronous operation, timeout/cancellation, permissions, Web restrictions |
| Time | Wall and monotonic clocks, units/precision, timezones, locale-independent operations |
| Environment variables | Explicit inputs, undefined values, name case sensitivity, secret handling |
| Execution boundary | Host API version, value/memory transfer, resource limits, unsupported feature reporting |

Do not assume complete emulation of every OS filesystem.
Define the portable subset and diagnostics for inputs outside it, avoiding operations that
succeed but change meaning on another OS.

### 2. Package compatibility and dependency resolution

Prefer Matra packages and supported Wasm packages.
Even Wasm packages must match the supported host imports, ABI, and execution model.
Make required runtime/API versions, features, and permissions inspectable throughout the dependency graph.

Pin versions and contents with the same dependency definitions and lockfile, and verify fetched content integrity.
Report unsupported dependencies, lock inconsistencies, and corrupt content explicitly;
do not silently fall back to another version.
OS-specific install scripts or local CLIs must not become hidden prerequisites.
Registry, manifest and lock formats, caching, updates, and offline behavior remain undecided.

Integrate npm and Python assets only after validating the requirements of each integration.
Existing `@matra/*` npm packages do not automatically qualify for the common runtime.
Do not promise compatibility with arbitrary npm/Python packages, native addons, or external runtimes.

### 3. OS-independent task definitions

Express startup and build operations using common features and explicit dependencies.
File copying, directory creation/removal, and supported compiler invocation should not require
`cp`, `rm`, PowerShell, or shell string expansion.

Define working directories, inputs/outputs, execution order, failure propagation, and permissions.
Mark tasks requiring external CLIs as extensions, with explicit prerequisites and exclusion from
the common guarantee.
Task syntax/file format and the extent of reuse of Matra Command's planning model remain undecided.

### 4. Continuous verification on three OSes

Use the same sample projects and lockfiles in Windows, macOS, and Linux CI.
Verify dependency resolution, startup, build, and execution in clean environments without OS-specific
edits to user-project source or configuration.
Distinguish CI host setup differences from differences in user projects.

Alongside success cases, add regression tests for case, Unicode, line endings, paths containing spaces,
non-portable names, insufficient permissions, unsupported dependencies, integrity violations, and task failures.
Compare outputs and error categories for deterministic samples.
When changing the compiler, also preserve existing Stage 2/3 byte equality verification.

## Phased roadmap

| Phase | Deliverable and completion condition |
| --- | --- |
| 1. Specify the guarantee | Define the support matrix, minimal host API, compatibility/permission/error contracts, and accepted/rejected examples in both languages |
| 2. Minimal vertical implementation | Load a local supported package and start, build, and run a sample using common APIs |
| 3. Reproduce dependencies | Implement transitive dependencies, locking, integrity, and caching to restore the same dependency set |
| 4. Formal PC support | Continuously verify the full workflow and failure cases in clean three-OS CI; publish distributions and the support matrix |
| 5. Extend coverage | Independently validate Web/mobile capability matrices, conditional npm/Python integrations, and external CLI extensions |

Introduce three-OS verification incrementally from phase 2 rather than deferring it to the final phase.
Declare formal support only after satisfying phase 4.

## Design decisions after v0.3

The [literate programming proposal](./literate-modules.md) describes multilingual integration
using named Markdown fences as virtual files.
It considers JavaScript module exposure, shorthands, and future Python integration; none is implemented.
It does not change the v0.3 minimal contract or existing grammar.

Build on the v0.3 Node.js host and single-source execution to decide formal PC host distribution
and the support matrix, file/path API extensions, local package loading units, and general task definitions.
Evaluate WASI, the Component Model, and reuse of existing hosts such as Node.js against this contract.
Do not settle on a Wasm format while postponing required host capabilities or distribution prerequisites.

For runtime distribution, prioritize making setup easy for users, then minimize installation time and
download size as well as distribution and maintenance costs. Prefer automatically obtaining and
configuring supported runtimes when practical, while considering distributions that bundle the
required runtimes for offline or restricted-network use. Decide supported versions, update behavior,
platform-specific packaging, and required license and third-party notices before formal support.
This is a future direction, not a promise that runtimes are currently installed or distributed this way.
