# Matra Math — Compute Engine adapter

Optional computation support for `@matra/math`, backed by Cortex Compute
Engine. The base package remains independent from any computation engine.

```ts
import { evaluateMatra, simplify } from "@matra/math-compute-engine"

evaluateMatra("Add(1, 2, 3)") // 6
simplify(["Add", "x", "x"]) // ["Multiply", 2, "x"]
numericEvaluateMatra("Multiply(radius, Cos(angle))", { radius: 10, angle: 0 }) // 10
```

Math expressions embedded in props can be evaluated across a graphics or
document tree:

```ts
import { parse } from "@matra/core"
import { numericEvaluateProps } from "@matra/math-compute-engine"

numericEvaluateProps(parse("circle(cx=Cos(theta))"), {
  theta: ["Divide", "Pi", 3],
})
```
