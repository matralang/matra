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

### Morphion

Math NotebookのMorphion表示は、legacy Morphionの単一base形式を一般化した多変数形式です。
式を次の有限和へ正規化します。

```text
sum(coefficient * product(basis[i] ^ exponent[i]))
```

Morphionの利点は、展開後も各項を係数と指数vectorに分けて扱えることです。同じ項を
まとめる、特定の基底を含む項を拾う、係数や次数を比較するといった処理を、入れ子の
MathJSONを毎回たどらずに行えます。多変数式でも基底ごとの指数が明示され、`Sin(x)`などは
関数の内部へ立ち入らず一つの基底として保てます。そのため、Compute Engineの計算結果を
変えずに、式の項構造を調査・比較する表示や後続処理へ利用できます。

MathJSONの識別子、定数、関数適用を基底原子として保持します。`Add`と`Subtract`は同じ
指数vectorの項をまとめ、`Multiply`は分配して項を合成します。整数冪は指数vectorへ加算し、
複素数は実部と虚部に分け、`ImaginaryUnit`を虚数基底として表現します。係数の演算と
簡約はCompute Engineに委譲します。項の順序は安定したJSON基底順、基底の順序はその
JSON表現の辞書順です。

関数適用を含む一般式も、その適用全体を基底原子として保持します。非整数冪および和を
分母に含む除算は展開せず、一つの原子として保持します。負の整数冪は指数として保持します。
分配後の項数が256を超える式は、巨大な展開を避けるためMorphion化を拒否します。この
形式はMathJSONの意味を置き換えず、式の同一性や数学的同値性を保証するものではありません。
また、Morphionは計算結果に追加で作る派生表現なので変換コストがかかります。項構造を
利用しない用途ではEvaluate/Simplify/Numericの結果を使い、256項を超えて拒否された場合も
Morphion表示だけを省略するのが適切です。

## 数式表現の設計方針

両パッケージは、次の共通方針で実装を進めます。

1. Content MathMLを正式な数式表現の基準とします。
2. Strict Content MathMLを意味論上の正規形とします。
3. 独自の数学的対象・演算はOpenMath Content Dictionary（CD）で定義します。

実装の基準は[MathML 3.0 Second Edition](https://www.w3.org/TR/MathML3/)です。
[Content Markup](https://www.w3.org/TR/MathML3/chapter4.html)の変換規則に従って
Content MathMLをStrict Content MathMLへ正規化します。ここでいう正規形は意味表現の
構造を統一するもので、代数的な簡約や数学的同値性の判定を保証するものではありません。
Presentation MathMLは表示のための表現として分離します。

`@matra/math`は数式のデータモデル、検証、正規化、入出力とCDのsymbol識別を担います。
`@matra/math-compute-engine`は対応するsymbolをCortex Compute Engineへ写像し、
計算結果を共通の意味表現へ戻すadapterを担います。MathJSONはengineとの交換形式として
扱い、数式の意味を定める仕様の正本にはしません。

標準の数学的対象には既存の[OpenMath CD](https://openmath.org/cd/)を優先します。
独自CDは安定した`cdbase`、CD名、symbol名で識別し、意味、引数、適用条件、versionと
互換性方針を文書化します。CDの定義とengineによる計算対応は別々に管理します。
未対応symbolは黙って別の意味へ置換せず、保持可能な経路では識別情報を保持し、
損失のない変換・計算ができない経路では明示的なdiagnosticを返す方針です。

[MathML 4](https://www.w3.org/TR/mathml4/)への移行に備え、version別の受理・検証・
入出力と、共通の意味モデルを分離します。2026年10月14日時点ではMathML 4は
Working Draftのため、MathML 3への適合とMathML 4の実験的対応は分けて管理します。
移行時は数値、symbol識別、束縛、属性、error位置およびCD参照の差分を確認し、
round-tripと意味の保持を回帰testで検証します。

この方針は既存APIやMatra Program／compiler sourceの文法を変更しません。既存APIを
置換する場合は、v0.xの破壊的変更として影響範囲とmigrationを別途明記します。

### Content MathML MVP

初回実装はMathML 3のContent MathML式木に限定します。公開APIは
`parseContentMathML(source)`、`normalizeContentMathML(source)`、
`serializeContentMathML(expression)`、`contentMathMLToMathJson(expression)`、
`mathJsonToContentMathML(expression)`です。
パーサーはContent MathMLをCD識別子付きの式木として保持し、serializerはMathML名前空間を
持つ`math`要素でStrict Content MathMLを出力します。正規化はContent MathML 3の変換規則の
うち、この節に列挙した構文だけを実装します。

受理する式は`ci`、整数・実数・double形式の`cn`、`csymbol`、`apply`と、
`apply`内の次の演算要素・定数要素です。

- `arith1`: `plus`、`times`、`minus`（1引数は`unary_minus`）、`divide`、`power`、`root`、`abs`
- `transc1`: `sin`、`cos`、`tan`、`exp`、`ln`
- `relation1`: `eq`、`neq`、`lt`、`gt`、`leq`、`geq`
- `nums1`: `pi`、`e`、`i`、`infinity`
- `logic1`: `true`、`false`

`cn type="rational"`は`nums1.rational`の適用へ変換します。演算要素と定数要素は
対応するOpenMath CD symbolを持つ`csymbol`へ正規化します。未知のCD symbolは
標準`cdbase`・CD名・symbol名を式木とStrict出力で保持します。MathML 3の`cdgroup`解決は
行わないため、`cdgroup`属性と標準以外の`cdbase`を必要とする文書は明示的に拒否します。
CDの定義検証と未知symbolのMathJSONへの変換は行いません。未対応の要素、属性、qualifier、Presentation MathML、binding、
共有参照、不正な数値・演算引数はdiagnostic付きで拒否します。これは一般のMathML 3
全体への適合を意味せず、MathML 4対応も含みません。

`cn type="double"`の`INF`、`-INF`、`NaN`はXML入出力で保持しますが、MathJSONの有限数値
境界では変換を拒否します。

MathJSON変換は既知symbolだけを既存のMathJSON演算名へ写像するengine交換境界です。
未知CD symbolとMathJSONで表現できない数値は識別情報を黙って捨てず、明示的に拒否します。
逆変換も対応済みMathJSON symbolだけをContent Dictionary identityへ戻します。
