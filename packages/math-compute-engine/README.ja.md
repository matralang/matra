# Matra Math — Compute Engine adapter

[English](./README.md) | [日本語](./README.ja.md)

`@matra/math`向けのoptional computation supportです。計算処理はCortex Compute Engineに委譲し、base packageは特定の計算engineへ依存しないままにします。

```ts
import { evaluateMatra, simplify } from "@matra/math-compute-engine"

evaluateMatra("Add(1, 2, 3)") // 6
simplify(["Add", "x", "x"]) // ["Multiply", 2, "x"]
numericEvaluateMatra("Multiply(radius, Cos(angle))", { radius: 10, angle: 0 }) // 10
```

Math Notebookなどのtoolingでは、`listStandardMathCommands()`で導入済みCompute Engineの
標準libraryにある関数・定数名、signature、descriptionを取得できます。MathJSONは
`morphionize(expression)`で多変数Morphion正規形へ変換できます。関数適用はbasis atomとして
保持し、算術式は係数と整数冪vectorへ集約します。

Graphicsやdocument treeのpropsに埋め込まれたmath expressionも評価できます。

```ts
import { parse } from "@matra/core"
import { numericEvaluateProps } from "@matra/math-compute-engine"

numericEvaluateProps(parse("circle(cx=Cos(theta))"), {
  theta: ["Divide", "Pi", 3],
})
```

このadapterは、Matraの構文・データ変換とsymbolic / numeric computationの責務を分離するための境界です。`@matra/math`だけを使う利用者はCompute Engineをinstallする必要がありません。

Content MathMLは直接評価でき、結果はCD-awareな意味式木として返ります。

```ts
import { evaluateContentMathML } from "@matra/math-compute-engine"

evaluateContentMathML('<math xmlns="http://www.w3.org/1998/Math/MathML"><apply><plus/><cn>1</cn><cn>2</cn></apply></math>')
// { kind: "number", type: "integer", value: "3" }
```

未知CD symbolの計算対応は未定義であり、暗黙の別symbolへの置換は行いません。

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

Content MathML MVPは対応するMathML 3式木の入出力、Strict形式への正規化、Compute Engine
評価を提供します。対応要素とsymbol写像、拒否範囲は[`@matra/math`](../math/README.ja.md)
に記載しています。CD定義の検証とMathML 4対応は未実装です。この機能は既存APIや
Matra Program／compiler sourceの文法を変更しません。既存APIを置換する場合は、v0.xの
破壊的変更として影響範囲とmigrationを別途明記します。
