# Matra Math

[English](./README.md) | [日本語](./README.ja.md)

Matra Mathは、domain-neutralな`@matra/core` ASTの上に構築するmath-domain layerです。最初の安定した境界は、Matra function syntaxとrecursive MathJSONの相互運用です。

```ts
import { parseMath } from "@matra/math"

parseMath("Add(1, Power(x, 2))")
// ["Add", 1, ["Power", "x", 2]]
```

歴史的な実装は、移行の参照として`legacy/bmath`に残しています。新しいcodeは、以前のprivate node shape（`head`, `attributes`, `children`）ではなく、Coreの`MatraAST`（`tag`, `props`, `children`）を使います。

MathJSON変換ではMatra propsを拒否します。propsを黙って捨てると式の意味を壊すためです。`Formula(expr)`はoptionalなdocument wrapperとして受け入れ、MathJSON boundaryでunwrapします。

## Computation

Cortex Compute Engine integrationはoptionalなworkspace packageとして提供します。

```ts
import { evaluateMatra } from "@matra/math-compute-engine"

evaluateMatra("Add(1, 2, 3)") // 6
```

adapterを分けることで、`@matra/math`は特定のsymbolic computation implementationを要求せず、構文とデータ形式だけを定義できます。
