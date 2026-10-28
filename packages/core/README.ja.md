# Matra Core

[English](./README.md) | [日本語](./README.ja.md)

Matra Coreは、ソースの構文解析と評価、およびHTML・Math・Graphicsで共有する
ドメイン非依存な文書ツリーを提供します。HTMLやSVGの出力規則は各domain packageに置きます。

## v0.3のソースと文書ツリー

公開`parse(source)`は、文と式からなる`MatraModule`を返します。
renderer用の`MatraAST`やMatraJSONを直接返すAPIではありません。
文法と評価の正本は[Grammar v0.3](../../spec/grammar.ja.md)です。

```ts
import { evaluateStatic, parse, staticValueToAST } from "@matra/core"

const module = parse(`
let title = "Matra"
article {
  h1 { title }
  <p.lead>Hello <strong>Matra</strong>!</p>
}
`)
const ast = staticValueToAST(evaluateStatic(module))
```

`evaluateStatic()`は静的な値・参照・ノードを取得します。関数呼び出し、演算、制御構文など、
実行が必要な式は`EvaluationRequiredError`で拒否します。
明示的に実行する場合は`evaluate(module)`を使います。
JavaScriptとの値・関数の連携には別途[文芸的プログラミングのhost](../../spec/literate-modules.ja.md)を使います。

```ts
import { evaluate, parse, staticValueToAST } from "@matra/core"

const ast = staticValueToAST(evaluate(parse(`
fn double(n) { return n * 2 }
ul {
  ...for (n in [1, 2, 3]) { li { double(n) } }
}
`)))
```

ノード構築は`circle(cx=10, cy=20, r=5) {}`のように本文の`{}`を付けます。
`Sin(x)`は関数呼び出しであり、文書ノードの構築とは区別します。
文法エラーは`ProgramSyntaxError`で、メッセージにsource offsetを含みます。
現在の`parse()`は`locations`・`sourceId`オプションや`parseWith()`を提供しません。

## モーフィオン文書モデル

文書nodeを指数と係数`val`の有限項として表します。
指数0はtag、正整数nはchildren[n - 1]、文字列keyはprops[key]です。

```ts
import { astToMorphion, morphionToAST } from "@matra/core"

const terms = astToMorphion({ tag: "p", props: { class: "lead" }, children: ["Hello"] })
// [{ exponent: 0, val: "p" }, { exponent: 1, val: "Hello" },
//  { exponent: "class", val: "lead" }]
const ast = morphionToAST(terms)
```

両方向でcopyし、nodeのpositionを除外します。係数0も文書の値として保持します。
係数内の子nodeは文書ASTで保持するnode単位の対応です。
[Data Model](../../spec/data-model.ja.md#モーフィオンとの対応)が契約を定めます。
数式展開用の`@matra/math-compute-engine`の`MorphionForm`とは区別します。

## 2つの文書ツリー表現

評価結果の文書値を`staticValueToAST()`で変換すると、Visitor、Transformer、Renderer用の
オブジェクト形式のASTになります。

```ts
const ast = {
  tag: "article",
  props: { lang: "ja" },
  children: ["text", { tag: "p", props: {}, children: ["Hello"] }],
}
```

交換用のMatraJSONは3要素の配列です。

```ts
["article", { lang: "ja" }, ["text", ["p", {}, ["Hello"]]]]
```

相互変換には`astToMatraJSON(ast)`と`matraJSONToAST(tuple)`を使います。
`visit()`と`transform()`もこの文書ASTを対象とし、`MatraModule`は受け取りません。
文書値の仕様は[Data Model](../../spec/data-model.ja.md)を参照してください。

## HTMLとSVG

```ts
import { evaluateStatic, parse, renderWith, staticValueToAST } from "@matra/core"
import { toHTML } from "@matra/html"

const ast = staticValueToAST(evaluateStatic(parse('<p.lead>Hello</p>')))
toHTML(ast)
// <p class="lead">Hello</p>
```

各domain packageの`MatraRenderer`は`renderWith(renderer, ast, options)`でも呼び出せます。
式を含むソースは先に評価してください。`evaluatePropExpressions(ast, evaluator)`は、
ホスト側で組み立てた文書ASTのproperty式を変換するための別の補助APIです。

## JSONMatraファイルファミリー

```text
.matra.json  = strict JSON-compatible Matra exchange format
.matra.js    = JavaScript-compatible Matra generation module
.jsonm       = experimental source placeholders
```

`loadMatra(path)`は`.matra.json`を`JSON.parse`で読み、`.matra.js`では信頼済みJavaScript
moduleのdefault exportを読みます。後者は任意のJavaScriptを実行します。
`.jsonm`は現状`matra.doc`と`matra.expr`のタグ付きsourceをplaceholderとして保持するだけで、
汎用JSON supersetのparserや評価器ではありません。

```js
import { matra, normalizeMatra } from "@matra/core"

export default matra.ast({
  tag: "article",
  props: {},
  children: ["Hello"],
})
```

`normalizeMatra()`と`matra.ast()`はホスト値を正規化する補助APIです。
これらの受理範囲は文書data modelの検証とは同一ではありません。交換・出力時には
JSON互換値を使い、rendererごとの入力条件を満たしてください。
`matra.doc`・`matra.expr`はソースを保持し、自動実行はしません。

## Markdown文書

`extractMatraMarkdown(markdown, { entry: "page.matra" })`は名前付きfenceからsourceを抽出します。
これはJavaScriptの依存解決・実行を行いません。抽出結果の`.source`を`parse()`へ渡します。
`extractMarkdownFences()`は名前付きfenceの一覧を返します。

### 実験的なNode.js向けliterate API

`@matra/core/experimental/literate`は文書のコンパイルと実行を提供します。Node.js 22/24を対象とし、
将来は独立packageへ分離予定です。通常のCore入口はNode.js固有のhostやcompilerを読み込みません。
文書化・テストされた公開APIですが、安定APIとしての互換性は保証しません。変更・移動時には移行手順を示します。

```js
import { readFile } from "node:fs/promises"
import { staticValueToAST } from "@matra/core"
import { buildLiterate, runLiterate } from "@matra/core/experimental/literate"
import { toHTML } from "@matra/html"

const markdown = await readFile("web-page.md", "utf8")
const bundle = await buildLiterate(markdown, { document: "web-page.md" })
const value = await runLiterate(bundle)
const html = toHTML(staticValueToAST(value))
```

文書先頭のYAML FrontMatterで`matra.entry`と省略可能な`matra.values`を指定します。
buildは文書コードを実行せず、runは実行結果の値を返します。通常の利用に中間ファイルは不要です。
関数・options・bundle・errorの型定義もサブパスから提供します。
`LiterateError`は`code`・`document`・`path`・`line`・利用可能な`cause`を持ちます。
bundleは`format: "matra-literate-1"`と`abi: "matra-value-1"`を持ち、JSON保存・復元が可能です。
ABIのない旧内部bundleは再buildしてください。

対応するcompiler Wasmとversion・SHA-256・ABIを記録したmanifestを同梱します。
導入後の利用にRust、checkout、compilerの追加downloadは不要です。
packageの開発・build・packにはRustが必要で、Stage 2/3のbyte一致を確認してWasmを生成します。
`pnpm test:literate:package`はcheckout外へのpack導入と、RustなしのAPI/CLI実行を検証します。
生成Wasmは配布物へ含めますが、ソース管理へは追加しません。

CLIも同じAPIを使います。

```sh
pnpm exec matra-literate build . web-page.md bundle.json
pnpm exec matra-literate run . bundle.json
```

信頼した文書・bundleだけを実行してください。OS sandboxやtimeoutは保証しません。
詳細は[公開API契約](../../spec/literate-modules.ja.md#v03の公開api配布契約)を参照してください。

値と関数の公開を含めて実行する経路は[文芸的プログラミング](../../spec/literate-modules.ja.md)を
参照してください。検証用の[Webページ作例](../html/examples/web-page.md)は、
MarkdownからJavaScript連携・Wasm実行を経てHTMLを生成します。

## TypeScriptテンプレート

`matra`テンプレートはソース文字列を返します。通常の文字列挿入は引用・escapeし、
`matra.raw()`は信頼済みのソース断片をそのまま挿入します。

```ts
import { evaluateStatic, matra, parse, staticValueToAST } from "@matra/core"

const title = "Matra & Web"
const source = matra`article { h1 { ${title} } }`
const ast = staticValueToAST(evaluateStatic(parse(source)))
```

## 標準コレクション関数

`Range`は終端を含む数列、`Map`はJavaScript関数を適用する補助APIです。

```ts
import { Map, Range, evaluateStandard } from "@matra/core"

Map(value => Number(value) ** 2, Range(1, 4))
// [1, 4, 9, 16]
evaluateStandard({ tag: "Range", props: {}, children: [1, 4] })
// [1, 2, 3, 4]
```

`evaluateStandard()`は文書AST上の`Range`・`Map`・`Lambda`・`Var`と登録済み関数を扱います。
v0.3の`parse()`が返す`MatraModule`用の評価器ではありません。

## パッケージ構造

```text
src/
├── ast/        # 文書の型、相互変換、走査、変換
├── program.ts  # 現行ソースのparser、静的取得、明示的評価
├── parser/     # 公開parse export、旧Peggy grammarの資産
├── jsonmatra.ts # ファイル入力とホスト値の補助API
├── markdown.ts # source fenceの抽出
├── render.ts   # renderer境界
└── standard.ts # 文書AST上の標準関数
```

現行`parse()`は`program.ts`を使用します。build時に再生成するPeggy parserは
現行公開parserではありません。生成ファイルを直接編集しないでください。

## ドキュメントの言語

英語文書は`name.md`、対応する日本語文書は`name.ja.md`とし、見出しとコード例を揃えます。
