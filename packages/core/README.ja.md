# Matra Core

[English](./README.md) | [日本語](./README.ja.md)

Matra Coreは、HTML、Math、Docs、Graphicsの各パッケージで共有する、小さくドメイン非依存な基盤です。ツリー表現、相互変換、走査、変換、交換可能なParserとRendererの境界を定義します。ドメイン固有の評価処理と出力規則はCoreの外に配置します。

ドメインパッケージは小さな`MatraRenderer`契約を実装し、`renderWith(renderer, ast, options)`で一貫して呼び出せます。Coreは境界だけを所有し、SVGやHTMLなどの出力規則は各パッケージに残します。

## 2つのツリー表現

Parserが生成し、交換形式として使用するMatraJSONは、コンパクトな3要素配列です。

```ts
["tag", { role: "example" }, ["text", ["child", {}, []]]]
```

CoreのVisitor、Transformer、Rendererが使用するASTはオブジェクト形式です。

```ts
{
  tag: "tag",
  props: { role: "example" },
  children: ["text", { tag: "child", props: {}, children: [] }]
}
```

境界では明示的に変換します。

```ts
import { astToMatraJSON, matraJSONToAST } from "@matra/core"
```

## 交換可能なParser

Parserは`parse(source, options?)`メソッドを実装し、ASTまたはMatraJSONを返します。`parseWith()`は、どちらの出力もASTへ正規化します。

```ts
import { parseWith } from "@matra/core"

const ast = parseWith(peggyParser, source)
```

同梱しているPeggy実装はMatraJSONを生成します。Coreの公開`parse()`はその出力をASTへ変換するため、Parserを交換可能な状態に保てます。

## JSONMatraファイルファミリー

Matraへ取り込むデータ形式は、関連する3つのJSONMatra形式に分けます。

```text
.matra.json  = strict JSON-compatible Matra exchange format
.matra.js    = JavaScript-compatible Matra generation module
.jsonm       = JSONMatra custom human-readable data format
```

`.matra.json`は、保存・交換・他言語連携向けです。読み込みは必ず
`JSON.parse`で行うため、コメント、trailing comma、`undefined`、`BigInt`、
関数、import、`matra(...)`呼び出しは拒否されます。

`.matra.js`は、TypeScript / JavaScriptアプリ連携向けです。信頼済みの
JavaScriptモジュールとして扱い、default exportをMatra値へ正規化します。

```js
import { matra } from "@matra/core"

export default matra.ast({
  tag: "tag",
  props: { prop1: "value1" },
  children: ["child1", "child2"],
})
```

`.matra.js`はdynamic `import()`で読み込むため、任意のJavaScriptコードが
実行されます。信頼済みコード用の形式とし、非信頼入力には`.matra.json`か、
将来の安全な`.jsonm` parserを使います。

`.jsonm`は、手書き・実験・DSL混在向けです。Matra向けのJSONスーパーセットを
目指しますが、JavaScriptをそのまま実行する形式ではありません。初期実装では
`matra.doc\`...\``と`matra.expr\`...\``のsourceをplaceholder値として
保持します。

どの形式も、読み込み後は共通の正規化レイヤーを通ります。

```ts
import { loadMatra, matra, normalizeMatra } from "@matra/core"

await loadMatra("example.matra.json")
await loadMatra("example.matra.js")
await loadMatra("example.jsonm")

normalizeMatra({ tag: "tag", children: ["child"] })
matra.tuple("tag", { prop1: "value1" }, ["child1", "child2"])
matra.doc`tag { child }`
matra.expr`Divide(Plus(1, Sqrt(5)), 2)`
```

diagnosticやeditor統合で必要な場合は、source positionを付与できます。
構文エラーは常にlocationとcode frameを持ちます。

```ts
const ast = parse(source, {
  locations: true,
  sourceId: "drawing.matra",
})

ast.position
// { start: { offset: 0, line: 1, column: 1 }, ... }
```

MatraJSON変換時にpositionは除外します。

## HTML

HTMLレンダリングは、独立したworkspaceパッケージから提供します。

```ts
import { parse } from "@matra/core"
import { toHTML } from "@matra/html"

toHTML(parse('p("Hello", class="lead")'))
```

関数形式の構文では、propsをPython風のキーワード引数で記述します。

```matra
circle(x=10, y=20, r=5)
```

通常の位置引数はchildrenになります。従来の`circle({x: 10, y: 20, r: 5})`形式も互換性のため利用できますが、標準記法ではありません。

関数適用を未評価のproperty式として記述できます。

```matra
circle(cx=Cos(theta), r=Divide(3, 8))
```

式は`props`内のAST nodeとして表現します。rendering前に
`evaluatePropExpressions(ast, evaluator)`で非破壊的に評価できます。

property valueに配列とobjectリテラルを再帰的に記述できます。ASTでは
通常のJSON互換valueとして保持します。

```matra
command(
  args=["solve.py", "--format", "json"],
  env={MODE: "production"},
  stdin={format: "json", value: {items: [1, 2, 3]}}
)
```

`circle({x: 10})`のような位置引数objectは、要素をpropsへmergeする
従来の意味を維持します。

## 標準コレクション関数

`Range`は終端を含む数列を生成し、`Map`は登録済み関数を各値に適用します。
`evaluateStandard()`は、JSON互換ASTにJavaScript関数を格納せずに、それらのMatra関数構文を評価します。

```ts
import { evaluateStandard, parse } from "@matra/core"

evaluateStandard(parse("Range(1, 4)"))
// [1, 2, 3, 4]

evaluateStandard(parse("Map(square, Range(1, 4))"), {
  functions: { square: value => Number(value) ** 2 },
})
// [1, 4, 9, 16]
```

`Map`は単一引数の`Lambda`も受け付けます。現行のJSON互換構文で
識別子と文字列値を区別できるよう、字句参照には`Var(name)`を使います。

```ts
evaluateStandard(
  parse("Map(Lambda(n, multiply(Var(n), Var(n))), Range(1, 4))"),
  { functions: { multiply: (a, b) => Number(a) * Number(b) } },
)
// [1, 4, 9, 16]
```

## パッケージ構造

```text
src/
├── ast/       # 型、相互変換、走査、変換
├── parser/    # 公開parser境界、grammar、生成parser
├── index.ts   # 公開export
├── printer.ts # ドメイン非依存のJSON serialize
├── render.ts  # 交換可能なrenderer境界
└── standard.ts # Range、Map、標準評価
tests/
├── ast.test.mjs
├── parser.test.mjs
├── render.test.mjs
└── standard.test.mjs
```

生成parserは`src/parser/grammar.pegjs`から再構築します。`generated.mjs`ではなく
grammarを編集してください。言語レベルの動作は
[Matra Specification](../../spec/README.ja.md)で定義します。

## ドキュメントの言語

英語文書は`name.md`、対応する日本語文書は`name.ja.md`とします。変更を同期しやすくするため、見出し構造とコード例は両言語で揃えます。
