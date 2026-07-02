# Matra Math

Matra Math defines the math-domain layer built on the domain-neutral
`@matra/core` AST. Its first stable boundary is conversion between Matra
function syntax and recursive MathJSON.

```ts
import { parseMath } from "@matra/math"

parseMath("Add(1, Power(x, 2))")
// ["Add", 1, ["Power", "x", 2]]
```

The historical implementation remains in `legacy/bmath` as a migration reference.
New code uses Core's `MatraAST` (`tag`, `props`, `children`) rather than the
former private node shape (`head`, `attributes`, `children`).

Matra props are rejected during MathJSON conversion because silently dropping
them would corrupt the expression. `Formula(expr)` is accepted as an optional
document wrapper and is unwrapped at the MathJSON boundary.

## Computation

Cortex Compute Engine integration is an optional workspace package:

```ts
import { evaluateMatra } from "@matra/math-compute-engine"

evaluateMatra("Add(1, 2, 3)") // 6
```

Keeping this adapter separate allows `@matra/math` to define syntax and data
without requiring a particular symbolic computation implementation.
