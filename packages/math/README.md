# Matra Math

[English](./README.md) | [日本語](./README.ja.md)

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

### Morphion

The Math Notebook's Morphion view generalizes the legacy single-base form to a
multivariate form. It normalizes an expression to a finite sum:

```text
sum(coefficient * product(basis[i] ^ exponent[i]))
```

Morphion's benefit is that every expanded term can be handled as a coefficient
and an exponent vector. Consumers can combine like terms, select terms by basis,
or inspect coefficients and degrees without repeatedly traversing nested
MathJSON. Exponents are explicit for multivariate expressions, while functions
such as `Sin(x)` remain opaque basis atoms. This makes it useful for inspecting
term structure or feeding coefficient-oriented follow-up operations without
changing the Compute Engine result.

MathJSON identifiers, constants, and function applications are retained as
basis atoms. `Add` and `Subtract` combine terms with the same exponent vector;
`Multiply` distributes and combines factors. Integer powers add to exponent
vectors. Complex values split into real and imaginary parts, with
`ImaginaryUnit` as the imaginary basis. Coefficient arithmetic and reduction
are delegated to the Compute Engine. Basis ordering uses lexicographic order of
the stable JSON representation; terms use a stable basis order.

General expressions containing function applications remain representable by
keeping each application as a basis atom. Non-integer powers and divisions by
sums are kept as one atom instead of being expanded; negative integer powers
remain exponents. Expressions whose distribution would exceed 256 terms are
rejected to avoid explosive expansion. This form does not replace MathJSON
semantics or assert expression identity or mathematical equivalence.
Morphion is an additional derived representation and has a conversion cost. Use
Evaluate/Simplify/Numeric directly when term structure is not needed; if the
256-term limit is exceeded, only the Morphion view should be omitted.

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

Adopting this policy changes neither existing APIs nor Matra Program/compiler
source grammar. Any replacement of existing APIs must separately document its
impact and migration as a v0.x breaking change.

### Content MathML MVP

The first implementation is limited to MathML 3 Content MathML expression trees.
The public APIs are `parseContentMathML(source)`,
`normalizeContentMathML(source)`, `serializeContentMathML(expression)`,
`contentMathMLToMathJson(expression)`, and
`mathJsonToContentMathML(expression)`. Parsing retains expressions as a tree with
Content Dictionary symbol identities; serialization emits Strict Content MathML
inside a `math` element in the MathML namespace. Normalization implements the
MathML 3 Content-to-Strict rewrites only for the constructs listed here.

Accepted expressions are `ci`, integer/real/double `cn`, `csymbol`, `apply`, and
the following operator and constant elements inside `apply`:

- `arith1`: `plus`, `times`, `minus` (one argument becomes `unary_minus`), `divide`, `power`, `root`, `abs`
- `transc1`: `sin`, `cos`, `tan`, `exp`, `ln`
- `relation1`: `eq`, `neq`, `lt`, `gt`, `leq`, `geq`
- `nums1`: `pi`, `e`, `i`, `infinity`
- `logic1`: `true`, `false`

`cn type="rational"` is rewritten as an application of `nums1.rational`.
Operator and constant elements normalize to `csymbol` elements with their
corresponding OpenMath CD identities. Unknown CD symbols are preserved in the
expression tree and Strict output with the standard `cdbase`, CD name, and symbol
name. MathML 3 `cdgroup` resolution is not implemented, so documents using the
`cdgroup` attribute or requiring a non-standard `cdbase` are explicitly rejected.
Their definitions are not validated and they cannot be converted to MathJSON.
Unsupported elements, attributes, qualifiers, Presentation MathML, bindings,
shared references, malformed numbers, and invalid operand counts are rejected
with diagnostics. This is not conformance to all MathML 3 Content Markup, and it
does not include MathML 4 support.

The `INF`, `-INF`, and `NaN` values of `cn type="double"` are preserved in XML
input/output, but rejected at the finite-number MathJSON boundary.

MathJSON conversion is an engine-interchange boundary that maps only known
symbols to existing MathJSON operation names. Unknown CD symbols and numbers that
MathJSON cannot represent are rejected explicitly rather than losing identity.
The reverse conversion likewise maps only supported MathJSON symbols back to
Content Dictionary identities.
