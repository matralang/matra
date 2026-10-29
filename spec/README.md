# Matra Specification

[English](./README.md) | [日本語](./README.ja.md)

Matra is a domain-neutral notation for describing a rooted tree. Package
versions are independent of this language specification version.

The key words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** express normative
requirements.

The current source grammar is v0.3. The v0.2 Data Model/AST documents describe document values;
the old Parser contract is historical. The grammar specification is authoritative for syntax and evaluation.

## Specifications

1. [Data Model](./data-model.md) — abstract values represented by Matra
2. [AST](./ast.md) — object-shaped in-memory representation
3. [Grammar v0.3](./grammar.md) — standard `.matra` source grammar, parsing, and evaluation contracts
4. [Parser v0.2 (historical)](./parser.md) — old parsing interface, output, modes, and errors
5. [Matra Program](./program.md) — draft executable profile for WebAssembly

Each English document is named `name.md`; its Japanese counterpart is named
`name.ja.md`. Both versions have the same normative meaning.

Historical proposal (not the current specification): [Matra Program for syntax](./for-loop-proposal.md).

## Design policy and roadmap

- [Matra Language White Paper v0.3](./whitepaper-v0.3.md) — a current, non-normative overview
  of design, document Morphion, JavaScript integration, self-hosting, application routes,
  limitations, and differences from historical documents.
- [Proposed v0.3 scope and release criteria](./release-v0.3.md) — package priorities,
  implementation stages, executable validation examples, and release criteria.
- [Portability policy and common runtime](./portable-runtime.md) — intended guarantee across the three
  PC OSes, v0.3 minimal host API and execution procedure, and package/task/validation roadmap;
  not a declaration of formal support.
- [Multilingual literate programming in Markdown](./literate-modules.md) — proposal for virtual files
  in named fences connecting JavaScript public values (functions and data) to Matra.
  Includes the initial explicit-entry/`.js.part` contract and execution procedure, with later shorthand/module proposals.

## Scope

Tags and property names have no built-in domain meaning. HTML rendering,
interpolation, directives, and evaluation belong to domain packages and are
outside v0.2.

## Historical documents

The old [Core v0.2 grammar](./archive/core-v0.2/grammar.md) is historical and must not
be applied to current source or parser implementations.

The non-normative, HTML-oriented Core v0.8 guides are retained in
[`archive/core-v0.8`](./archive/core-v0.8/README.md).
