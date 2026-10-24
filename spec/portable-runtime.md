# Matra portability policy and common runtime roadmap

[English](./portable-runtime.md) | [日本語](./portable-runtime.ja.md)

## Status

This document guides future design and implementation; it does not declare implemented APIs or formal support.
The concrete common host API, package format, and task definitions remain undecided.
It changes neither general Matra Program nor compiler source grammar, existing ABIs, or public APIs.
The [unified grammar](./unified-grammar.md) remains authoritative for syntax and evaluation.

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
- The [unified grammar Wasm host](../crates/matra-seed/host/unified-host.mjs) provides a provisional
  host value ABI, not a completed common runtime with filesystem and networking APIs.
- [Matra Command](../packages/command/README.md) provides external process integration through execution
  plans and explicit authorization. Even `shell: false` does not guarantee an external program's
  availability or portability. Keep existing execution features and position them as extensions
  connecting to environment-specific operations.
  Capability declarations alone do not place child processes in an OS sandbox.
- [`loadMatra`](../packages/core/src/jsonmatra.ts) is a document loader using Node.js file APIs and
  module loading. Its role is distinct from common package loading and dependency resolution.
- The [bootstrap artifact workflow](../.github/workflows/bootstrap-artifact.yml) runs on Ubuntu.
  Shared verification from dependency resolution through build and execution across all three OSes
  remains future work.

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

## Next design decisions

First decide the PC host implementation/distribution model and support matrix, minimal file/path APIs,
local package loading unit, and how to start and build the minimal sample.
Evaluate WASI, the Component Model, and reuse of existing hosts such as Node.js against this contract.
Do not settle on a Wasm format while postponing required host capabilities or distribution prerequisites.
