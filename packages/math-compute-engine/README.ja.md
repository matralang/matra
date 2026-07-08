# Matra Math — Compute Engine adapter

[English](./README.md) | [日本語](./README.ja.md)

`@matra/math`向けのoptional computation supportです。計算処理はCortex Compute Engineに委譲し、base packageは特定の計算engineへ依存しないままにします。

```ts
import { evaluateMatra, simplify } from "@matra/math-compute-engine"

evaluateMatra("Add(1, 2, 3)") // 6
simplify(["Add", "x", "x"]) // ["Multiply", 2, "x"]
numericEvaluateMatra("Multiply(radius, Cos(angle))", { radius: 10, angle: 0 }) // 10
```

Graphicsやdocument treeのpropsに埋め込まれたmath expressionも評価できます。

```ts
import { parse } from "@matra/core"
import { numericEvaluateProps } from "@matra/math-compute-engine"

numericEvaluateProps(parse("circle(cx=Cos(theta))"), {
  theta: ["Divide", "Pi", 3],
})
```

このadapterは、Matraの構文・データ変換とsymbolic / numeric computationの責務を分離するための境界です。`@matra/math`だけを使う利用者はCompute Engineをinstallする必要がありません。
