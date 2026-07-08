# `legacy/bmath` migration map

[English](./MIGRATION.md) | [日本語](./MIGRATION.ja.md)

| `legacy/bmath` area | Destination | Policy |
| --- | --- | --- |
| private Peggy parser | `@matra/core` | 置き換える。copyしない |
| `matra-math-json.ts` | `src/math-json.ts` | 最初に移行する |
| exact `Expr` algebra | 将来の`@matra/math` modules | semantic testで性質をcharacterizeした後に保持する |
| TeX parser/printer | optional adapter | Coreの外に置く |
| Morphion forms | experimental math layer | public export前にinvariantを仕様化する |
| Compute Engine calls | `../math-compute-engine` | vendor dependencyをbase bridgeの外に置く |

最初の移行で見つかったCoreへのfeedback: JSON-compatibleなMatra syntaxには、signed number、decimal、exponent、`null` literalが必要です。これらはmath-domain semanticsではないため、Coreに属します。
