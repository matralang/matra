# `legacy/bmath` migration map

[English](./MIGRATION.md) | [日本語](./MIGRATION.ja.md)

| `legacy/bmath` area | Destination | Policy |
| --- | --- | --- |
| private Peggy parser | `@matra/core` | replaced, not copied |
| `matra-math-json.ts` | `src/math-json.ts` | migrated first |
| exact `Expr` algebra | future `@matra/math` modules | retain after semantic tests are characterized |
| TeX parser/printer | optional adapter | keep outside Core |
| Morphion forms | optional Compute Engine adapter | multivariate Morphion invariants are documented in the README; legacy `Expr` conversion remains unmigrated |
| Compute Engine calls | `../math-compute-engine` | keep vendor dependency out of the base bridge |

Core feedback discovered during the first migration: JSON-compatible Matra
syntax needs signed, decimal, exponent, and `null` literals. These belong to
Core because they are not math-domain semantics.
