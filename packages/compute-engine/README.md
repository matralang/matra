# Matra Math — Compute Engine adapter

Optional computation support for `@matra/math`, backed by Cortex Compute
Engine. The base package remains independent from any computation engine.

```ts
import { evaluateMatra, simplify } from "@matra/math-compute-engine"

evaluateMatra("Add(1, 2, 3)") // 6
simplify(["Add", "x", "x"]) // ["Multiply", 2, "x"]
```
