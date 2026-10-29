# Matra Language White Paper v0.3

[English](./whitepaper-v0.3.md) | [日本語](./whitepaper-v0.3.ja.md) | [仕様索引](./README.ja.md)

**構造を記述し、既存言語とつなぎ、文書を作品にする。**

- 作成日：2026年10月29日
- 対象：Matraの現行ソース文法v0.3と、その文書モデル・実行系・応用経路
- 調査基準：repositoryのcommit
  [`5e11d9d`](https://github.com/matralang/matra/commit/5e11d9de5190d1773f70df4b9180d68807394fd1)
- 位置づけ：設計思想と実装の到達点を説明する非規範的な白書。release完了やnpm公開の宣言ではない

## 要旨

Matraは、文書・データ・プログラムをつなぐための構造記述言語である。
中心に置くのは、HTMLなどの出力形式ではなく、tag・properties・ordered childrenから成る
ドメイン非依存の文書ツリーである。ソースに書いた式や制御構文を評価してこのツリーを作り、
用途別のパッケージでHTML、SVG、数式の表現へ接続する。

v0.3の設計は次の三つを柱とする。

1. **構造を数学的に扱う。** 文書nodeを指数から係数への有限写像として捉える
   Morphionを導入し、文書ASTと値を失わずに相互変換する。
2. **既存言語から学び、役割を分ける。** JavaScriptのデータや関数をJavaScriptのまま記述し、
   明示した値境界を通してMatraの文書構築へつなぐ。
3. **説明と実行を創作につなげる。** Markdownに説明・Matra・JavaScriptをまとめ、
   WebAssemblyで実行し、HTMLとCSSを生成する経路を提供する。

構文の正式化、実験的APIの実装、配布検証、正式サポートは異なる段階である。
本書では実装済みの限定範囲と将来構想を区別し、「あらゆる言語・形式をすでに統一した」とは主張しない。

## 1. 解決したい課題

文書、計算、図形、アプリケーションを組み合わせるとき、形式ごとに別の構文木と変換処理を持つと、
構造の受け渡しや意味の保持が難しくなる。一方、すべての処理を一つの新言語へ移すことも、
既存言語の資産や得意分野を失わせる。

Matraはこの間に共通の構造を置く。何を表すかを文書ツリーへ、どう計算するかを評価系や
既存言語へ、どう出力するかをdomain packageへ分担する。
HTMLの`p`やSVGの`circle`は用途側が意味を与える名前であり、Coreに組み込まれた命令ではない。

目指すのは万能の置換言語ではなく、読み書きできる構造と明示的な接続点である。
ここでの「学ぶ」は既存言語の記法や機能を尊重して取り込む設計姿勢を指し、
機械学習や自動的に文法を獲得する機能を意味しない。

## 2. v0.3の範囲と仕様の関係

本書のv0.3は現行のソース文法と開発段階を指す。
各npm packageのversion、Data Model／AST文書のv0.2、Program ABI draftのversionとは別管理である。
旧白書のv0.6や旧Core guideのv0.8より数字が小さいことは、機能の単純な後退や互換性を意味しない。

| 文書 | 役割 |
| --- | --- |
| [Grammar v0.3](./grammar.ja.md) | 一般のMatra Programとcompiler sourceの構文、parse・評価の正本 |
| [Data Model](./data-model.ja.md)・[AST](./ast.ja.md) | 評価後の文書値、交換表現、文書Morphion |
| [Matra Program](./program.ja.md) | native実行profileと暫定compiler ABI |
| [Literate modules](./literate-modules.ja.md) | 実装済みの明示入口・`.js.part`連携と、未実装の後続設計 |
| [Portable runtime](./portable-runtime.ja.md) | 最小host APIと移植性の目標・制限 |
| [v0.3 release条件](./release-v0.3.ja.md) | packageごとの優先度、検証記録、公開判定 |

矛盾がある場合、構文・評価は文法仕様を、各APIと実行経路は対応する契約を優先する。
本書は新しい文法やABIを追加しない。

## 3. 共通の文書モデル

### 3.1 構文木と文書ツリーを分ける

`parse(source)`は、宣言・式・制御構文を保持する`MatraModule`を返す。
これはrendererへ渡す文書ASTではない。ソース全体には複数の文を書けるため、
parse時点で単一rootを要求しない。

評価した結果を文書として使うとき、`staticValueToAST()`で`MatraAST`へ変換する。
文書data modelは一つのroot nodeを表し、各nodeは次の三つを持つ。

| 要素 | 内容 |
| --- | --- |
| `tag` | nodeを識別する文字列 |
| `props` | 文字列keyから値へのmap |
| `children` | nodeまたは値の順序付きlist |

```json
{
  "tag": "p",
  "props": { "class": "lead" },
  "children": ["Hello", 0]
}
```

交換用の**MatraJSON**では、同じnodeを固定長の3要素配列で表す。

```json
["p", { "class": "lead" }, ["Hello", 0]]
```

`tag`は文字列、`props`はmap、`children`はlistであり、欠落を`null`にする旧形式とは異なる。
値は文字列、有限数、boolean、null、配列、mapを基本とするJSON互換の値である。
関数、`undefined`、BigInt、非有限数、循環は文書値ではない。
JavaScript連携で使える関数値を、そのまま文書として出力できるわけではない。

`astToMatraJSON()`と`matraJSONToAST()`は文書ASTと交換表現を接続する。
node形式と同じ3要素の配列をデータとして保持する場合の包み方は
[Data Model](./data-model.ja.md#matrajson)に従う。
source positionは構文解析時の付随情報であり、文書の等価性やMatraJSONには含めない。

### 3.2 文書Morphion

文書nodeを、指数から係数`val`への有限写像として捉える。
指数はnode内の位置またはkeyを表す。

| 指数 | 係数の意味 |
| --- | --- |
| 数値`0` | tag |
| 正整数`n` | `children[n - 1]` |
| 文字列`key` | `props[key]` |

先の文書は次の項列で表せる。

```json
[
  { "exponent": 0, "val": "p" },
  { "exponent": 1, "val": "Hello" },
  { "exponent": 2, "val": 0 },
  { "exponent": "class", "val": "lead" }
]
```

数値`0`と文字列`"0"`は別の指数なので、tagと同名のproperty keyは衝突しない。
`astToMorphion()`と`morphionToAST()`は、source positionを除き、
childの順序、property key、値を保って往復する。
これはnode単位の対応であり、係数内の子nodeは文書ASTとして保持する。
配列やmapの内部を勝手にnodeへ再解釈しない。

tagの項はちょうど一つ、childの指数は1から連続する安全な整数とする。
重複・欠番・不正な指数は拒否し、逆変換は項の入力順に依存しない。
正変換はtag、child順、property keyのUTF-16 code unit順で出力する。
係数の`0`、`false`、`null`、空文字列も保持する。

このモデルは構造の数学的な対応を与えるもので、通常の多項式計算ではない。
項の加算・乗算や零項の除去は定義しない。
数式展開用の`@matra/math-compute-engine`の`MorphionForm`とは別物である。
通常のHTML生成にMorphion変換を挟む必要もない。

## 4. 書きやすさと明示性を両立する文法

文書nodeは`tag.classes(attributes) { ... }`で構築する。
通常の`name(args)`は関数呼び出しであり、名前だけからnodeへ読み替えない。

```matra
fn double(n) { return n * 2 }
article.card(lang="ja") {
  <h1>Matra</h1>
  ul {
    ...for (n in [1, 2, 3]) { li { double(n) } }
  }
}
```

この例の本文には三つの`li`が並び、それぞれ`2`、`4`、`6`を保持する。
`for`は反復結果の配列を返し、`...`はその配列をchild列へ一段だけ展開する。
`...`を省いた通常の配列値は一つのchildであり、暗黙には展開しない。

- 文は改行または`;`で区切る。spaceだけでは文を区切らない。
- `let`、`if`、`for`などのheaderには規則に従って丸括弧の省略形も使える。
- `if`／`else_if`／`else`は選択したblockの値を返す。`while`／`do-until`、代入、関数も扱う。
- node属性はカンマまたは空白・改行で区切れるが、関数引数・配列・objectのカンマは省略しない。
- 現行の通常文字列はescapeや文字列内改行に対応せず、末尾カンマも拒否する。

XML-style markupは同じnodeを構築する補助記法である。
属性は文字列、本文はtextと子要素で、空白を保持する。
`.class` shorthandを使えるが、式の補間は行わない。
`<br />`は使える一方、`<br>`、boolean属性、終了tagの省略、HTMLの自動補正、
DOCTYPEや外部entityを含む完全なXMLの処理は対象外である。

v0.3はv0.xの破壊的変更を含む。旧`tag[props]`、bodyなしの関数node記法、
backtick／tilde text、`$root`、旧directive中心の例を現行ソースへそのまま適用しない。
詳細と移行対象は[文法仕様](./grammar.ja.md#状態と互換性)を参照する。

## 5. parse・静的取得・実行・出力

```text
Matra source
  -> parse -> MatraModule
      -> evaluateStatic（実行を要する式は拒否）
      または evaluate（明示的に実行）
  -> 文書値 -> staticValueToAST -> MatraAST
      -> MatraJSON / 文書Morphion
      -> HTML / SVGなどのdomain renderer
```

静的取得はliteral、静的なbinding・参照・nodeなどに限定し、
call・operator・制御構文などを`EvaluationRequiredError`で拒否する。
失敗した静的取得から実行へ暗黙にfallbackしない。
文法エラーは`ProgramSyntaxError`として報告する。
現行TypeScriptの`parse()`は`locations`・`sourceId`オプションを提供しない。

```js
import { evaluate, parse, staticValueToAST } from "@matra/core"
import { toHTML } from "@matra/html"

const source = `
fn double(n) { return n * 2 }
article.card(lang="ja") {
  <h1>Matra</h1>
  ul {
    ...for (n in [1, 2, 3]) { li { double(n) } }
  }
}
`
const ast = staticValueToAST(evaluate(parse(source)))
const html = toHTML(ast)
// <article lang="ja" class="card"><h1>Matra</h1><ul><li>2</li><li>4</li><li>6</li></ul></article>
```

rendererは文書ツリーに用途別の出力規則を与える。
HTMLのescapingやvoid elementの扱いは`@matra/html`が担い、CoreのtagにHTMLの意味を埋め込まない。
escapingは出力上の機能であり、任意の文書を安全に実行・配信できることの保証ではない。

## 6. MarkdownとJavaScriptをつなぐ

### 6.1 説明をソースと一緒に持つ

Markdown文書の名前付きfenceを仮想ファイルとして扱う。
文書先頭のYAML FrontMatterで入口と公開する値を選択し、未選択のblockは実行しない。
以下を一つの`example.md`として保存できる。

````markdown
---
matra:
  entry: main.matra
  values:
    - data.js.part
    - analytics/total.js.part
---

# データから文書をつくる

```data.js.part
[10, 20, 30]
```

```analytics/total.js.part
values => values.reduce((sum, value) => sum + value, 0)
```

```main.matra
p { analytics.total(data) }
```
````

`.js.part`は単一のJavaScript式であり、データだけでなく関数も公開できる。
`analytics/total.js.part`はMatra側の`analytics.total`になる。
標準の`.js` moduleのimport/export、npmやPythonの直接連携は、この初版経路には含まれない。
Markdown全体をMatra文法で解析するのでも、説明文を自動的にHTMLへ変換するのでもない。

### 6.2 buildとrunを分ける

```js
import { readFile } from "node:fs/promises"
import { staticValueToAST } from "@matra/core"
import { buildLiterate, runLiterate } from "@matra/core/experimental/literate"
import { toHTML } from "@matra/html"

const markdown = await readFile("example.md", "utf8")
const bundle = await buildLiterate(markdown, { document: "example.md" })
const value = await runLiterate(bundle)
const html = toHTML(staticValueToAST(value))
// <p>60</p>
```

buildは設定・名前・式構文を検証し、MatraをWasmへcompileする。文書中のユーザーコードは実行しない。
runは選択したJavaScript式をパス順に各1回初期化し、入口のMatraをWasmで実行する。
再実行時は新しいJavaScript contextを作る。通常のCoreの`evaluate()`とは別のhost連携経路である。

値は明示した境界でcopyする。JSON互換のdata subsetとJavaScript関数の公開に対応する一方、
循環、accessor、独自prototype、疎配列、`undefined`、非有限数、Promiseなどは拒否する。
Matra関数をJavaScriptへ渡す機能や非同期連携は未対応である。
文書結果には関数を含められない。

このAPIはNode.js 22/24向けの実験的サブパスであり、安定APIの互換性は保証しない。
対応compiler Wasmを配布物へ同梱する設計・実装があり、導入後の利用にRustや追加のcompiler downloadを要しない。
一方、repositoryで配布物をbuild・検証する側ではRustとbootstrapを使う。
配布実装やpack検証の存在とnpm公開済みであることは区別する。

`LiterateError`はcode、文書名、仮想パス、行、利用可能なcauseを保持する。
compile診断は元文書へ対応づけるが、実行時は入口block位置であり、式単位のsource mapではない。
OS sandboxやtimeoutは保証しないため、信頼した文書・bundleだけを実行する。

## 7. 自己ホストとWebAssembly

Matra製compilerは、Matraで書いたcompiler sourceをWasmへcompileできる。
Rust seedを出発点に、次の順で検証する。

```text
Rust seed + compiler source -> Stage 1 Wasm
Stage 1  + compiler source -> Stage 2 Wasm
Stage 2  + compiler source -> Stage 3 Wasm
                              Stage 2 == Stage 3（byte単位）
```

`pnpm bootstrap:verify`はbyte equalityだけでなく、
各Stageで共通の受理・拒否・実行fixtureとportableサンプルを検証する。
これはbootstrapの再現性を示すが、任意の入力に対する正しさや本番compilerとしての完成を証明しない。

一般文書のhost value profileと、`module`宣言が選ぶnative compiler profileは標準文法を共有する。
ただし、native側は`i32`、`bytes`、array、struct pointerなどの限定された型・ABIを使い、
両profileを暗黙に変換しない。
compilerの36-byte result recordや`matra-value-1`などのABIは、
ソース文法のversionと区別して扱う。
compilerはexperimentalであり、resource limit、fuzzing、ABI安定化などは継続課題である。
詳細は[seed compiler](../crates/matra-seed/README.ja.md)を参照する。

## 8. 移植性とホストの責任

目標は、Windows・macOS・Linuxで同じプロジェクトを、ソースや設定を書き換えずに
依存解決・起動・build・実行できることである。任意の外部CLIより、依存関係を含む移植性を優先する。

現在の小さな実動版はNode.js hostを使い、明示的な`runtime` bindingを通して
version、引数、UTF-8 textの読み書き、標準出力を提供する。
root相対の`/`区切りpathを使い、大小文字の不一致、symlink、不正UTF-8などを診断する。
path検査は移植性のための制約であり、OS security sandboxではない。

調査基準commitの[release条件の記録](./release-v0.3.ja.md#release判定のチェックリスト)では、
Windows・macOS・Linux × Node.js 22/24で検証サンプルから同じHTMLを得る確認を完了としている。
これは対象サンプル・検証環境での実績であり、任意の依存関係やOS最低versionまで含む
正式サポートの宣言ではない。独立runtime、package manager、汎用task engine、
npm/Python統合は今後の範囲である。

## 9. 応用パッケージと到達点

| 層・package | 現在の役割 | 区別すべき制限 |
| --- | --- | --- |
| [`@matra/core`](../packages/core/README.ja.md) | parser、静的取得・評価、文書AST、MatraJSON、文書Morphion、走査・変換 | `MatraModule`と文書ASTは別。汎用`.jsonm`は未実装 |
| [`@matra/html`](../packages/html/README.ja.md)・[`@matra/styles`](../packages/styles/) | HTML出力とCSS、Webページ生成経路 | Web framework、hydration、汎用site generator全体ではない |
| [`@matra/graphics`](../packages/graphics/README.ja.md) | 共通ASTからのSVG、shape、defs、filter | Canvas/WebGLやanimationの完成を意味しない |
| [`@matra/math`](../packages/math/README.ja.md) | MathJSON交換、Content MathML MVP、CD-awareな意味表現 | MathML全体の実装・適合や数学的同値性判定ではない |
| [`@matra/math-compute-engine`](../packages/math-compute-engine/README.ja.md) | Compute Engineによる評価・簡約・数値化、数式Morphion | 文書Morphionとは別。数式展開は256項制限があり、一般式の完全な同値判定ではない |
| [`@matra/command`](../packages/command/README.ja.md) | 検査可能な計画、明示認可、process実行、JSON/NDJSON | 認可metadataはprocess隔離ではない。portable runtimeのAPIとも別 |
| [`@matra/kernel`](../packages/kernel/README.ja.md)・[VS Code拡張](../packages/vscode/README.ja.md) | Notebook表示や編集支援 | 持続session、完全なNotebook体験、LSP・完全な型推論は約束しない |

数式domainではContent MathMLを意味表現の基準、Strict Content MathMLを構造上の正規形、
OpenMath CDをsymbol識別の基盤とする。MathJSONはengine交換に使う。
文書の共通ASTと、数学の意味モデル・計算engineは同一視しない。
用途別packageには旧API・旧ソース例が残る場合があるため、一般の`.matra`構文は現行文法を優先する。

## 10. 再現可能な検証経路

repository checkoutにNode.js 22/24、rootの`packageManager`指定のpnpm、
repository指定のRust toolchainを用意し、rootで実行する。

```sh
pnpm install --frozen-lockfile
pnpm example:web-page
pnpm test:web-page
```

[Webページの実行文書](../packages/html/examples/web-page.md)から、
JavaScriptのデータと関数、Matraの反復・文書構築、Wasm実行を経て
`packages/html/examples/dist/index.html`と`matra.css`を生成する。
生成後はオフラインで閲覧できる。
testは3件の記事、合計24分、escaping、生成fileとrender結果・固定checksumの一致を確認する。
文書Morphionの変換を行う作例ではない。

追加の検証入口は次のとおりである。

```sh
pnpm test:literate:package
pnpm test:portable
pnpm bootstrap:verify
```

順に、checkout外でのpack導入とRustなしのAPI/CLI実行、host APIとサンプルのbuild/run、
自己ホストのbyte equalityと各Stageの共通動作を確認する。
これらは再検証の手順であり、本書の作成だけで全commandを新たに実行したという記録ではない。
release判定では固定commit、配布物、checksum、対応CIの結果を組にして記録する。

## 11. 旧白書から何を継承し、何を改めたか

2025年10月の日本語旧白書は「White Paper v0.6」、提示された英語旧資料は
「Language Specification v0.2 (Draft)」を名乗る。両者は同一revisionの翻訳対ではなく、
現行v0.3の規範資料として扱わない。
構造を共通言語にする発想と自己記述への志向を継承し、現在は境界と実装範囲を明確にする。

| 旧資料の記述・構想 | 現行v0.3での整理 |
| --- | --- |
| Matrastを中心に文書・データ・コードを統一 | `MatraModule`、文書`MatraAST`、MatraJSONを区別し、文書Morphionとの対応を定義 |
| `null`や省略を許すtuple、`Entry[]` root | 文書交換は`[string, map, list]`。source moduleの文列とは別 |
| PeggyでMarkdown・HTML・JSONを混在解析 | 標準Matra文法、限定XML-style markup、Markdownのfence loader、JSON交換を分離 |
| HTML templateのinterpolation・`m-if`・`m-each` | 現行標準ソースは式・`if`・`for`・明示child展開で記述。旧directiveは現行文法の根拠にしない |
| `toTeX`・`toESTree`・`toCanvas`などの出力構想 | 現行の代表経路はHTML・SVG・数式交換。旧白書の全renderer APIを実装済みとして引き継がない |
| 自己ホストを将来目標にする | Rust seedからMatra製compilerへ進み、Stage 2/3のbyte equalityで検証 |

歴史的な[Core v0.2文法](./archive/core-v0.2/grammar.ja.md)と
[Core v0.8 guide](./archive/core-v0.8/README.ja.md)は既存archiveに残す。
旧[directive資料](./archive/core-v0.8/03-directives.ja.md)も当時のHTML template設計を知る参考資料である。
外部の旧白書を現行仕様として再収録せず、現在の説明への入口を本書に置く。

## 12. 今後の方向

v0.3では、文書モデルの一貫性と、説明から実行・出力までの検証可能な小さな経路を優先する。
既存API、compiler artifact、diagnostic、配布物の対応を保ち、
SVG・数式・編集環境の成熟度は個別に示す。

その先には、標準JavaScript module・npm・Pythonとの接続、依存関係を含むruntimeの提供、
より詳細なsource map、resource limit、ABIの安定化がある。
これらは現行の実装済み機能ではなく、設計・検証を要する後続課題である。
v0.xでは親しみやすい記述と実験を優先し、v1.xへ向けて型安全性・静的解析・互換性の保証を整える。

Matraが共通化するのは、すべての用途の意味そのものではない。
構造を共有し、意味を与える層を分け、言語や出力を明示的につなぐ。
この境界を保ちながら、読める文書を実行可能な創作の基盤へ育てることが、v0.3の立場である。
