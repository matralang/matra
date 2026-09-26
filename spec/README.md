# Matra Specification

[English](./README.md) | [日本語](./README.ja.md)

Matra is a domain-neutral notation for describing a rooted tree. Package
versions are independent of this language specification version.

The key words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** express normative
requirements.

The current source grammar is v0.3. The v0.2 Data Model/AST documents describe document values;
the old Parser contract is historical. The unified grammar is authoritative for syntax and evaluation.

## Specifications

1. [Data Model](./data-model.md) — abstract values represented by Matra
2. [AST](./ast.md) — object-shaped in-memory representation
3. [Unified Grammar v0.3](./unified-grammar.md) — unified `.matra` source and syntax
4. [Parser](./parser.md) — parsing interface, output, modes, and errors
5. [Matra Program](./program.md) — draft executable profile for WebAssembly

Each English document is named `name.md`; its Japanese counterpart is named
`name.ja.md`. Both versions have the same normative meaning.

Historical proposal (not the current specification): [Matra Program for syntax](./for-loop-proposal.md).

## Scope

Tags and property names have no built-in domain meaning. HTML rendering,
interpolation, directives, and evaluation belong to domain packages and are
outside v0.2.

## Historical documents

The non-normative, HTML-oriented Core v0.8 guides are retained in
[`archive/core-v0.8`](./archive/core-v0.8/README.md).
