# Matra Specification v0.1

[English](./README.md) | [日本語](./README.ja.md)

Matra is a domain-neutral notation for describing a rooted tree. Package
versions are independent of this language specification version.

The key words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** express normative
requirements.

## Specifications

1. [Data Model](./data-model.md) — abstract values represented by Matra
2. [AST](./ast.md) — object-shaped in-memory representation
3. [Grammar](./grammar.md) — source text and syntax
4. [Parser](./parser.md) — parsing interface, output, modes, and errors

Each English document is named `name.md`; its Japanese counterpart is named
`name.ja.md`. Both versions have the same normative meaning.

## Scope

Tags and property names have no built-in domain meaning. HTML rendering,
interpolation, directives, and evaluation belong to domain packages and are
outside v0.1.

## Historical documents

The non-normative, HTML-oriented Core v0.8 guides are retained in
[`archive/core-v0.8`](./archive/core-v0.8/README.md).
