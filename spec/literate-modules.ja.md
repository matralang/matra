# Markdownによる多言語の文芸的プログラミング（設計案）

[English](./literate-modules.md) | [日本語](./literate-modules.ja.md) | [索引](./README.ja.md)

## 状態と対象

本書は初版の実装契約と将来の設計案を区別して記述する。正式な文法仕様ではない。
実装範囲は次節の明示入口と`.js.part`に限定する。後続の`.js`・npm・Python連携例は未実装である。
[共通ランタイムのロードマップ](./portable-runtime.ja.md)を補足するが、
v0.3の最小実動版にnpm・Python連携を追加するものではない。

対象は、一般のMatra Programを含むMarkdown文書の読み込み、モジュール解決、
言語間連携と開発環境である。Matra compiler sourceの文法変更は対象外とする。
専用CLIとFrontMatter設定を追加する変更であり、Matra source、compiler ABI、AST/data model、
parserは変更しない。literate hostの設定APIとCLIは、呼び出し側のentry/value指定から
文書FrontMatterを正本とする契約へ移行する。
[文法仕様](./grammar.ja.md)と既存のcompiler sourceのbootstrap契約を維持する。
以下の初版契約以外の未決事項は、後続段階で確定する。

## 初版の実装契約

対象は一般のMatra Programのホスト連携であり、Matra文法とcompiler sourceは変更しない。
既存のmember/call、文書生成とhost value ABIを利用する。

```text
pnpm literate -- build ROOT DOCUMENT.md OUTPUT.json
pnpm literate -- run ROOT OUTPUT.json
```

文書先頭のYAML FrontMatterに`matra.entry`と`matra.values`を指定する。
入口は単一の`.matra`仮想ファイル、値は`.js.part`のlistとする。
`matra.values`を省略した場合は空listとし、指定しないblockは初期化・実行しない。
build APIとCLIは実行環境上の文書名・pathだけを受け取り、entry/value設定は文書から読む。
FrontMatterのない文書、無効なYAML、欠落または不正な設定はdiagnosticにする。
暗黙のimportや実ファイル検索はない。
`ROOT`と実ファイルのパスは[共通ランタイムの論理パス契約](./portable-runtime.ja.md)に従う。
出力はversion付きJSON bundle（Wasm、選択した式と元位置）とし、`run`は文書data modelの
JSONをstdoutへ1行で出力する。関数などJSONで表せない文書結果はエラーとする。
[実行可能なサンプル](../crates/matra-seed/examples/literate-values.md)は合計`60`を含む文書を生成する。
回帰testは`node --test crates/matra-seed/tests/literate-runtime.test.mjs`で実行する。

### 仮想ファイルと形式

- FrontMatterは文書の先頭に置き、`matra` mappingの`entry`と`values`を設定する。
  `entry`は必須の文字列、`values`は省略可能な文字列listである。
  他のFrontMatter項目はこのruntimeでは使用しない。YAMLとしてparseし、不正な形式や型を拒否する。
- fenceは行頭から0〜3個のspace、3個以上のbacktickまたはtildeで開く。
  閉じdelimiterは同種で開き以上の長さとし、後ろはspace/tabのみとする。
  CRLFはLFへ正規化する。本文の行番号を保持し、閉じ忘れを拒否する。
  外側fence内の説明例を仮想ファイルとして再走査しない。
- info全体を前後trimした単一のファイル名として扱う。拡張子のない言語名fenceは説明用とする。
  ファイル名は`/`区切り、各componentはASCIIのidentifierまたはそれにdot接尾辞を付けた形とし、
  `.`・`..`、空component、絶対パス、backslash、queryを拒否する。
  パスは大小文字を区別するが、大小文字だけ異なる重複も拒否する。
- 全名前付きfenceの重複パスを登録時に拒否する。`.js`と`.js.part`は別形式として登録し、
  接尾辞を除いたパスをdot区切りの公開名へ対応させる。
  同じ公開名と親子の公開名（`a`と`a.b`）は、未選択ブロックを含め衝突エラーとする。
- 選択した入口は`.matra`、値は`.js.part`のみ受理する。標準`.js`モジュール、その他の形式、
  `?values`引数ヘッダーは未対応として診断する。本文から形式を推測しない。
  Matraのbindingと同名の公開rootは既存のduplicate-binding診断で拒否する。
- `.js.part`はstrict modeで本文全体を括弧で囲んだ単一のJavaScript式として構文検証する。
  object式、関数式、arrow、改行とJavaScript commentを受理する。
  import/export宣言、複数文、末尾semicolonを拒否する。別形式へのfallbackはない。

### 登録・build・実行

登録は名前・衝突・選択対象を検証し、buildは選択した式の構文検証とMatraのWasm生成だけを行う。
どちらもユーザー式や関数本体を実行しない。実行時は選択した値をASCIIパス昇順で各1回初期化し、
その後に入口を実行する。関数本体は呼び出し時だけ実行する。
再実行では新しいJavaScript contextと値を作り、同一実行内のclosure状態だけを保持する。
各式は共通の新規contextで評価するが、公開名・MatraのbindingはJavaScriptへ注入しない。
JavaScript標準の同期組み込みのみを想定し、Node.jsの`process`・`require`、timer、import、
文字列からのcode生成、Wasm生成を提供しない。OS sandboxやtimeout保証ではないため、
信頼した文書だけを選択して実行する。
初版はWasm実行のみを提供し、別のインタプリタ方式は追加しない。
将来の方式もこの初期化・呼び出し契約を共有し、build時評価を導入しない。

### 値境界とdiagnostic

境界では`null`、boolean、有限数、文字列、密な配列、plain objectのown enumerableな
文字列key/data propertyを再帰copyする。JavaScriptからMatraへは関数値も公開できる。
Matraから渡す引数はcopyし、JavaScript側の変更をMatraへ反映しない。戻り値もcopyする。
共有参照は保存せず、循環、accessor、symbol key、非enumerable property、疎配列、
独自prototype、`undefined`、BigInt、非有限数、Promise/thenableを拒否する。
文書ノードはplain dataとして渡せるが、数式・binary・クラスinstanceの特別な変換は行わない。
Matra関数のJavaScriptへの引き渡し、非同期処理は未対応とする。
JavaScript関数の`this`は`undefined`とし、非関数の呼び出しは既存hostの明示的エラーとする。
文書出力は上記data subsetのみを受理し、関数値は拒否する。

loaderは`LiterateError.code`と元文書・仮想パス・本文開始行を報告し、
JavaScript例外はcause/stackに元の行・列を保持する。Matraのcompile診断は元文書行へ対応させる。
Matra実行時エラーは入口ブロック位置を報告する（式単位のsource mapは後続段階）。
重複、未対応形式、欠落、構文・初期化・呼び出し・値境界の失敗を成功扱いにしない。
後続の設計例と初版の制約が異なる場合、この節を初版の正本とする。

## v0.3の公開API・配布契約（実装予定）

この節はv0.3で完成させる契約であり、現在の内部関数が公開済みであることを意味しない。
v0.3では新しいnpm packageを増やさず、`@matra/core/literate`サブパスからNode.js向けの
`buildLiterate`、`runLiterate`、`LiterateError`と対応する型定義を実験的に提供する。
Node.js固有の実行機構とcompiler供給の実装は通常のCore入口から分離し、
将来の独立package化を予定する。独立packageの名称と分離時期は未定であり、分離時には移行手順を示す。
通常の`@matra/core`のimportはliterate hostやcompiler Wasmを読み込まず、
Node.js固有moduleへの新しい依存を持たせない。HTML rendererにも実行機能を含めない。
CLIのcommand名は公開前に固定する。
ブラウザ実行、標準JavaScript module・npm・Pythonの直接importはこの公開APIの範囲外とする。

### 関数と値の契約

| API | 入力 | 成功時の結果 | 実行しないこと |
| --- | --- | --- | --- |
| `buildLiterate(markdown, options?)` | Markdown文字列、省略可能な文書名`options.document` | 実行用bundleを返すPromise | 文書中のJavaScript式・関数とMatraプログラムの実行、HTML生成 |
| `runLiterate(bundle)` | 対応する形式・ABIの実行用bundle | 文書data subsetの値を返すPromise | 再コンパイル、HTML生成、ファイルへの出力 |

`options.document`は診断用の名前で、省略時は`<markdown>`とする。ファイルを自動で読み込む指定ではない。
entryとvaluesはFrontMatterを正本とし、呼び出し側からの上書きは拒否する。
対応するcompiler Wasmを同梱するため、通常の利用でcompilerのpath指定や取得設定は要求しない。

buildの戻り値はJSONとして保存・復元できるversion付きbundleとする。Wasmに加えて選択した
JavaScriptソースと元位置を含み、ソース秘匿や任意version間の互換性は保証しない。
対応するbundle形式とcompiler/host ABIを明記し、非対応の組み合わせは実行前に拒否する。
同じbundleの複数回実行は可能だが、JavaScript contextと値は毎回新規に作る。
contextの分離は、任意のユーザーコードの結果が常に同じになることを保証しない。

runの結果はAST専用型ではなく、既存の値境界を満たす値とする。
rendererへ渡す文書nodeは、必要に応じてCoreの`staticValueToAST()`でASTへ変換する。
通常の作例ではbundleをメモリ内で渡し、中間ファイル、JSONへの変換と読み戻し、
子プロセスを必須にしない。

```js
import { staticValueToAST } from "@matra/core"
import { buildLiterate, runLiterate } from "@matra/core/literate"
import { toHTML } from "@matra/html"

const bundle = await buildLiterate(markdown, { document: "web-page.md" })
const value = await runLiterate(bundle)
const ast = staticValueToAST(value)
const html = toHTML(ast)
```

上記は公開予定の利用例であり、サブパスのexportと配布実装は未完了である。現在のrepository内の相対importは
暫定的な検証経路であり、別project向けの導入手順として掲載しない。
CLIは同じbuild/run実装を利用する薄い入口とし、別の評価規則を持たせない。

### 失敗・依存関係・公開条件

- 設定・compile・実行・値境界の失敗はPromiseのrejectとして伝える。
  `LiterateError.code`、文書・仮想パス・位置、利用可能なcauseを保持し、
  compilerの取得・読込・ABI不一致の失敗も識別できるようにする。
  メッセージ全文やstack文字列の一致は互換性契約にしない。
- APIは結果を返し、通常の進捗をstdoutへ出力しない。CLIのrunのstdoutは結果JSONだけとし、
  診断はstderr、失敗は非zero終了statusで伝える。build時に文書中のコードを実行しない。
- Node.js 22/24、Windows/macOS/Linuxを検証対象とする。OS sandboxやtimeoutは保証せず、
  信頼した文書・bundleだけを実行する。install時に文書コードを実行しない。
- 検証済みのcompiler Wasmを`@matra/core`の配布物へ同梱し、version・checksum・対応ABIを記録する。
  導入後のbuild/runはcompilerを追加downloadせず、利用者のRustやcheckout内のbootstrap/cacheを要求しない。
  配布物の作成・検証側ではRustとbootstrapを利用できる。同梱による配布容量の増加も確認する。
  Wasmの欠落・破損・非対応ABIを明示エラーとし、downloadやローカルbuildへ暗黙にfallbackしない。
- 公開API・型定義・runtime依存・compiler artifactがpackした配布物で揃うことを確認する。
  checkout外の空projectから導入し、公開importだけでbuild→run→HTML生成できることを検証する。
  キャッシュのない初回利用、対応OS/Node、非対応bundle、compiler供給の失敗も検証する。
- v0.xの実験的な公式APIとして提供し、破壊的変更はrelease noteと移行手順で明示する。
  packageを作成しただけで公開完了とはせず、配布検証をreleaseの必須条件とする。

実装順序は、既存のP0経路の正しさ・値境界・diagnostic・bootstrap検証を先に保ち、
同梱Wasmの生成・検証手順を整えてからサブパスのexport・型定義・CLI接続・作例の公開importへの移行を行う。
これはv0.3の利用者向け経路を完成させる作業であり、P1/P2の機能拡張より優先する。

## 中心方針

> 短く書きたい人はできるだけ短く、正確に書きたい人は正確に。

- Markdownを説明とコードをまとめる入口にする。
- 名前付きコードブロックを仮想ファイルとして扱い、パスと拡張子を活用する。
- JavaScriptは本来のJavaScriptとして扱う。Matra内にJavaScriptの方言を追加して
  npm互換性を実現しようとはしない。
- JavaScript式を値として扱い、関数だけでなくデータセット、オブジェクト、配列、数値なども公開する。
- 値形式には対応する明示的なexport形式を用意し、同じ公開名と値の利用契約を持たせる。
- 言語間の接続は明示的な公開値を基本とし、各言語の全変数を暗黙に共有しない。
- 実行に必要な依存関係で接続し、説明上のブロックの配置順へ不用意に依存しない。

## 名前付きfenceを仮想ファイルにする

次は通常のJavaScriptモジュールを使う提案例である。

````markdown
```analytics.js
export function total(values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```

```main.matra
let result = analytics.total([10, 20, 30])
p { result }
```
````

`analytics`は予約語ではなく、`analytics.js`の拡張子を除いたパスに由来する名前である。
`total`はJavaScriptの名前付きexportに由来する。Markdownのファイル名には依存しない。
例の`main.matra`は入口の候補を表し、自動的に実行する規則を確定するものではない。
Matra側では結果`60`を持つ文書ノードを得ることを想定する。

機能単位にファイルを分ける場合は、default exportを利用できる設計とする。

````markdown
```analytics/total.js
export default function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```

```main.matra
let result = analytics.total([10, 20, 30])
p { result }
```
````

| 仮想ファイル | 公開対象 | Matraでの参照 |
| --- | --- | --- |
| `analytics.js` | 名前付きexportの`total` | `analytics.total(...)` |
| `analytics/total.js` | default export | `analytics.total(...)` |

後者はパスの各要素を名前空間へ対応させ、default exportを末端の名前へ割り当てる。
これはMatraとの連携規則であり、JavaScript標準のimport規則を変更するものではない。
同じ名前を生成する複数の定義は、順序による上書きや暗黙の併合ではなくエラーにする。
例えば、上記二つの定義を同じ解決範囲に置くと`analytics.total`が衝突する。

例では同じ文書から`analytics`を直接参照する書き心地を示す。
実際の公開範囲と、明示的importを選択できるかどうかは未決とする。
実ファイルに切り出しても同じパスと公開契約を維持することを目指すが、
仮想ファイルと実ファイルの検索規則や優先順位は実装前に定める。

## 明示形と短縮形

JavaScriptブロックは、明示的なモジュール形式と、一つの式が表す値を公開する値形式を持つ。
値形式はモジュールの宣言群として解釈せず、JSONがデータを表すように、本文全体を値の定義として扱う。
関数も値の一種であり、関数だけを特別に短縮する仕組みではない。
引数ヘッダー形式は、その式を返す関数値を定義するための省略記法である。

形式は本文の推測ではなく、仮想ファイル名で区別する。

| ファイル名 | 本文の解釈 |
| --- | --- |
| `foo.js` | 標準JavaScriptモジュール |
| `foo.js.part` | 一つのJavaScript式が表す値 |
| `foo.js.part?values` | `values`を引数に取り、本文の式を返す関数値 |

`.js.part`は式の断片を示し、公開名を作る際には接尾辞全体を除く。
例えば`analytics/total.js.part`の公開名は`analytics.total`である。
`.partial.js`を別名としては採用しない。通常の`.js`では値形式への暗黙の切り替えを行わず、
`.js.part`ではimport/export宣言をモジュールとして受理しない。
両形式が同じ公開名を生成する場合は、既述の衝突規則に従う。

以下の関数例は、いずれも同じ関数を`analytics.total`として公開する。
値形式と引数ヘッダーはMarkdownローダーの規則であり、標準JavaScriptモジュールの構文ではない。
通常の`.js`ファイルへ切り出す際は、明示的なexport形式への展開が必要になる。

### 1. 明示形：標準JavaScriptモジュール

````markdown
```analytics/total.js
export default function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```
````

通常のimport、名前付きexport、複数の宣言が必要な処理はモジュール形式で書けるようにする。
default exportと名前付きexportが混在する場合のMatraへの公開方法は未決とする。

### 2. 値形式：一つのJavaScript式

````markdown
```analytics/total.js.part
function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```
````

本文全体を一つのJavaScript式として解釈し、その評価結果をパスに対応する公開値にする。
上記は関数式を値として定義する例であり、アロー関数も同じモデルで扱う。

````markdown
```analytics/total.js.part
values => values.reduce((sum, value) => sum + value, 0)
```
````

名前のない`function (values) { ... }`を単独で置く形は、標準JavaScriptモジュールとしては
有効な文ではないが、値形式では有効な関数式である。
明示形との対応は`export default <式>`で表せるが、これは公開契約の対応を示すものであり、
値形式の本文をモジュールとして解釈することを意味しない。

関数に限らず、データセットや数値も定義できる設計とする。

````markdown
```datasets/sales.js.part
[
  { label: "A", amount: 10 },
  { label: "B", amount: 20 }
]
```

```settings.js.part
{ title: "Sales", scale: 2 }
```

```constants/taxRate.js.part
0.1
```

```main.matra
let rows = datasets.sales
p { settings.title }
for (row in rows) {
  p { row.amount }
}
p { constants.taxRate }
```
````

オブジェクトの`{ ... }`も文のblockではなく式として扱う。
配列、オブジェクト、数値、文字列、boolean、nullなどは値形式の対象とし、
公開値が関数である場合だけ呼び出せる。
JSONに似た利用体験を目指すが、JSON parserを使うものでも、JSONへserializeするものでもない。
JavaScript式は関数呼び出しなどの副作用を持ち得るため、静的データと同じ安全性は保証しない。
評価時期・回数、共有・変更可能性、式から参照できる名前は実装前に定める。
モジュール形式と値形式は前述のファイル名で判別する。
構文エラーを契機に別形式として再試行するfallbackは採用しない。

### 3. 引数ヘッダーと式の短縮形

````markdown
```analytics/total.js.part?values
values.reduce((sum, value) => sum + value, 0)
```
````

- `analytics/total.js.part`は仮想ファイルのパスである。
- `?values`は関数の引数宣言であり、URL queryの値や呼び出し時の引数ではない。
- 本文は一つのJavaScript式であり、その評価結果を戻り値にする。
- `?values`はモジュールの識別や公開名に含めない。

この例は明示形の`export default function (values) { return ... }`へ展開する。
本文を関数bodyとは扱わないため、`return`文や複数の文はこの形式では受理しない。
複数の文が必要なら関数式または明示的なモジュールを使う。
複数引数、引数なし、default値、分割代入、rest parameter、asyncの記法は未決とする。
オブジェクト式、改行、comment、末尾semicolonの扱いも実装前に定義する。

## 共通ランタイムと各言語の役割

```text
Markdown
  └─ 名前付きブロックの収集とモジュール解決
       ├─ Matra → compiler → Wasm
       ├─ JavaScript → JavaScript module
       └─ Python → Python実行環境（将来）
                    ↕
             共通の呼び出し契約
```

共通ランタイムは起動、依存関係、公開関数の接続、エラーの伝播を担当する。
全言語をWasmへcompileすることは必須ではない。
最初はNode.jsホストと既存の
[暫定host value ABI](../crates/matra-seed/host/value-host.mjs)を足場にできるが、
既存ABIをそのまま安定した共通プロトコルとして保証しない。
WASIやComponent Modelの採否も別途判断する。

JavaScriptブロック内から標準のimportでnpm資産を使う方向とするが、
依存宣言、lock、対応version、解決基準を先に定める。
任意のnpm packageやnative addonの互換性、3 OSでの同一動作、Webでの動作は保証しない。
Pythonは将来の拡張であり、実行環境やパッケージ連携の方式は未決である。

引数・戻り値について、数値、文字列、配列、オブジェクト、文書ノード、数式、
巨大整数、バイナリ、関数参照の対応範囲とcopy/共有の意味を定義する。
例外、非同期処理、timeout・cancel、モジュール初期化、循環依存も契約に含める。
現在の同期host callがJavaScriptのPromiseを自動的に待つとは扱わない。

## コンパイルと評価の意味

コンパイル方式とインタプリタ方式で、同じプログラムの評価順や副作用の意味を変えない。
コンパイルは構文解析・検証・コード生成を行う工程であり、
ユーザーの式やモジュール初期化をbuild時に実行することを意味しない。
これらの評価は実行時に行う。

次の三つの工程を区別する。

1. 名前の登録：仮想ファイルのパスと公開名を収集する。本文のユーザーコードは実行しない。
2. 値の初期化：式を評価してデータや関数値を作る、またはモジュールを初期化する。
   この工程で副作用が起こり得る。
3. 関数の呼び出し：公開された関数の本体を実行する。

JavaScriptの関数宣言の巻き上げは「最初に全コードを評価すること」ではない。
関数宣言は同じスコープの宣言前から呼べるが、本体は呼び出し時に実行される。
関数式・アロー関数も、関数値を作ることと本体を実行することを区別する。
名前の登録だけで、その値が初期化済みであるとは扱わない。

初期化の具体的な順序・回数、依存関係と前方参照、循環依存、
再実行時の状態は引き続き未決とする。
コンパイル／インタプリタの選択を、それらの規則を切り替える暗黙のスイッチにはしない。

## 実行対象と開発体験

ファイル名付きのfenceが存在するだけで文書内の全コードを自動実行しない。
説明用のコード例と実行対象を区別し、入口、依存先、重複パス、初期化順を定義する。
権限承認と実行環境の制約も明示し、仮想ファイルやWasmをOS sandboxとは扱わない。

開発環境では拡張子から言語を判定し、引数ヘッダーも認識する。
一般的なMarkdownツールでは`analytics/total.js.part?values`の構文強調が
自動で有効になるとは限らない。
補完、import解決、型チェック、整形、デバッグを各言語の既存ツールに接続する。
短縮形の引数も補完・解析の対象にする。
生成コードへの固定offsetではなく、元のMarkdownと生成モジュールの位置対応を保持し、
構文エラーと実行時エラーを元のブロックの行・列に対応させる。
短縮形から明示形への展開や実ファイルへの切り出しを開発支援の候補にする。

## 実装前の決定事項と検証

本書の例は提案する受理例であり、適合性テストが通っていることを意味しない。
上記の未決事項に加え、パスの基準、許可する名前、大小文字・Unicode正規化、
拡張子、`?`の区切り、fenceの空白・comment・delimiterの契約を日英で確定する。
共通ランタイムの既存の論理パス契約との関係も明示する。

実装は次の順で段階的に進める。

1. 名前付き仮想ファイル、明示入口、選択した`.js.part`の同期的な値・関数連携を実装する（初版）。
2. 標準JavaScriptモジュールとimport・npm依存、引数ヘッダーを別段階で検討する。
3. 依存管理とエラー位置・補完・デバッグの対応を整える。
4. 呼び出し契約に沿ってPython連携を個別に検討・検証する。

少なくとも次の回帰testを追加する。

- 三つの形式と名前付きexport形式で、Matraから呼び出した結果が`60`になること。
- 値形式の配列・オブジェクト・数値・文字列・boolean・nullをMatraから利用でき、
  データセットを関数化せず参照できること。非関数の呼び出しは明確に失敗すること。
- 単なるparse成功だけでなく、生成モジュールとMatraの文書出力を検証すること。
- 同じ公開名、重複仮想パス、不正パス、欠けたモジュール・exportを拒否すること。
- 引数ヘッダー形式の`return`文、複数の文、不正なJavaScriptを拒否し、
  別形式へのfallbackや暗黙の成功にしないこと。
- 説明用ブロックを実行せず、ブロック順を変えても依存関係に従うこと。
- 例外、非同期処理、初期化失敗が、定めた契約と元のMarkdown位置で通知されること。
- comment、改行、delimiter、値形式とモジュール形式の境界を検証すること。
- `.js`と`.js.part`の判別、接尾辞を除いた公開名、形式間の名前の衝突を検証すること。
- 名前の登録でユーザーコードを実行せず、コンパイル時にも実行しないこと。
  両実行方式で、定めた初期化順・副作用・結果が一致すること。
- 既存のMatra文書とcompiler sourceのfence選択・実行を維持すること。

parser、AST/data model、lowering、runtime、diagnosticの影響を個別に確認し、
不要な層を変更しない。互換性を壊す実装ではv0.xの破壊的変更と明示し、
影響を受けるexamples、tests、README、migration文書を列挙する。
compiler/bootstrapへ影響する場合はRust seedとStage 1/2/3を検証し、
Stage 2/3の生成Wasmのbyte equalityを維持する。
