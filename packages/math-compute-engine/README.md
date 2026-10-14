# Matra Math — Compute Engine adapter

[English](./README.md) | [日本語](./README.ja.md)

Optional computation support for `@matra/math`, backed by Cortex Compute
Engine. The base package remains independent from any computation engine.

```ts
import { evaluateMatra, simplify } from "@matra/math-compute-engine"

evaluateMatra("Add(1, 2, 3)") // 6
simplify(["Add", "x", "x"]) // ["Multiply", 2, "x"]
numericEvaluateMatra("Multiply(radius, Cos(angle))", { radius: 10, angle: 0 }) // 10
```

Tooling can retrieve the installed Compute Engine standard library catalog via
`listStandardMathCommands()`, including command names, signatures, and
descriptions. MathJSON expressions can be normalized to the multivariate
Morphion form with `morphionize(expression)`: function applications remain basis
atoms while arithmetic is collected into coefficients and integer exponent
vectors.

Math expressions embedded in props can be evaluated across a graphics or
document tree:

```ts
import { parse } from "@matra/core"
import { numericEvaluateProps } from "@matra/math-compute-engine"

numericEvaluateProps(parse("circle(cx=Cos(theta))"), {
  theta: ["Divide", "Pi", 3],
})
```

Content MathML can be evaluated directly. The result is converted back to the
CD-aware semantic expression tree:

```ts
import { evaluateContentMathML } from "@matra/math-compute-engine"

evaluateContentMathML('<math xmlns="http://www.w3.org/1998/Math/MathML"><apply><plus/><cn>1</cn><cn>2</cn></apply></math>')
// { kind: "number", type: "integer", value: "3" }
```

Computation for unknown Content Dictionary symbols is unsupported; they are
never silently replaced with another symbol.

## Mathematical representation policy

Both packages will follow this shared implementation policy:

1. Content MathML is the authoritative standard for mathematical representation.
2. Strict Content MathML is the semantic normal form.
3. Custom mathematical objects and operations are defined by OpenMath Content Dictionaries (CDs).

The implementation baseline is [MathML 3.0 Second Edition](https://www.w3.org/TR/MathML3/).
Content MathML is normalized to Strict Content MathML using the rewrite rules in
[Content Markup](https://www.w3.org/TR/MathML3/chapter4.html). This normal form
standardizes semantic structure; it does not guarantee algebraic simplification
or decide mathematical equivalence. Presentation MathML is a separate display representation.

`@matra/math` owns the mathematical data model, validation, normalization,
input/output, and CD symbol identity. `@matra/math-compute-engine` maps supported
symbols to Cortex Compute Engine and maps results back to the shared semantic
representation. MathJSON is an engine interchange format, not the authoritative
specification of mathematical meaning.

Prefer existing [OpenMath CDs](https://openmath.org/cd/) for standard objects.
Identify custom CDs by stable `cdbase`, CD name, and symbol name, and document
meaning, arguments, applicability, version, and compatibility policy. Manage CD
definitions separately from engine support. Unsupported symbols must not silently
acquire a different meaning: preserve their identity where possible, and report
explicit diagnostics where lossless conversion or computation is unavailable.

Prepare for [MathML 4](https://www.w3.org/TR/mathml4/) by separating version-specific
acceptance, validation, and input/output from the shared semantic model. As of
October 14, 2026, MathML 4 is a Working Draft; track MathML 3 conformance separately
from experimental MathML 4 support. Migration must review numbers, symbol identity,
binding, attributes, error locations, and CD references, with regression tests
for round trips and preservation of meaning.

The Content MathML MVP supports the documented MathML 3 expression subset,
Strict Content MathML normalization, and Compute Engine evaluation. Supported
elements, symbol mappings, and rejected inputs are described in the
[`@matra/math` README](../math/README.md). CD definition validation and MathML 4
support are not implemented. This feature changes neither existing APIs nor
Matra Program/compiler source grammar. Replacing an existing API would require
separately documenting its impact and migration as a v0.x breaking change.
