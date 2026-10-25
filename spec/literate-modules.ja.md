# Markdownによる多言語の文芸的プログラミング（設計案）

[English](./literate-modules.md) | [日本語](./literate-modules.ja.md) | [索引](./README.ja.md)

## 状態と対象

本書は将来の設計案であり、実装済みの機能や正式な文法仕様ではない。
以下の複数言語の連携例は、現在のCLIでは実行できない。
[共通ランタイムのロードマップ](./portable-runtime.ja.md)を補足するが、
v0.3の最小実動版にnpm・Python連携を追加するものではない。

対象は、一般のMatra Programを含むMarkdown文書の読み込み、モジュール解決、
言語間連携と開発環境である。Matra compiler sourceの文法変更は対象外とする。
本変更は文書の追加のみであり、既存source、API、ABI、AST/data model、
parser、runtime、diagnosticの動作を変更しない。
[統一文法](./unified-grammar.ja.md)と既存のcompiler sourceのbootstrap契約を維持する。
将来の実装前に、本書の未決事項と既存のfence選択との互換性を確定する。

## 中心方針

> 短く書きたい人はできるだけ短く、正確に書きたい人は正確に。

- Markdownを説明とコードをまとめる入口にする。
- 名前付きコードブロックを仮想ファイルとして扱い、パスと拡張子を活用する。
- JavaScriptは本来のJavaScriptとして扱う。Matra内にJavaScriptの方言を追加して
  npm互換性を実現しようとはしない。
- 短縮形には対応する明示形を用意し、同じ公開名と呼び出し契約を持たせる。
- 言語間の接続は明示的な公開関数を基本とし、各言語の全変数を暗黙に共有しない。
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

以下の三つは、同じ関数を`analytics.total`として公開するための書き方とする。
短縮形はMarkdownローダーの規則であり、標準JavaScriptモジュールの構文ではない。
通常の`.js`ファイルへ切り出す際は、明示形への展開が必要になる。

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

### 2. 関数式の短縮形

````markdown
```analytics/total.js
function (values) {
  return values.reduce((sum, value) => sum + value, 0)
}
```
````

ブロック全体が一つの関数式である場合、その関数をdefault exportとして扱う。
アロー関数も候補に含める。

````markdown
```analytics/total.js
values => values.reduce((sum, value) => sum + value, 0)
```
````

名前のない`function (values) { ... }`を単独で置く形は、標準JavaScriptモジュールとしては
有効な文ではない。ローダーが関数式として扱い、明示形へ展開する。
モジュール形式と関数式形式の判別規則は実装前に定める。
構文エラーを契機に別形式として再試行するfallbackは採用しない。

### 3. 引数ヘッダーと式の短縮形

````markdown
```analytics/total.js?values
values.reduce((sum, value) => sum + value, 0)
```
````

- `analytics/total.js`は仮想ファイルのパスである。
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
[暫定host value ABI](../crates/matra-seed/host/unified-host.mjs)を足場にできるが、
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

## 実行対象と開発体験

ファイル名付きのfenceが存在するだけで文書内の全コードを自動実行しない。
説明用のコード例と実行対象を区別し、入口、依存先、重複パス、初期化順を定義する。
権限承認と実行環境の制約も明示し、仮想ファイルやWasmをOS sandboxとは扱わない。

開発環境では拡張子から言語を判定し、引数ヘッダーも認識する。
一般的なMarkdownツールでは`analytics/total.js?values`の構文強調が
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

1. 名前付き仮想ファイル、入口選択、標準JavaScriptモジュールの公開・呼び出しを実装する。
2. 曖昧でない判別規則に従って、関数式と引数ヘッダーの短縮形を実装する。
3. 依存管理とエラー位置・補完・デバッグの対応を整える。
4. 呼び出し契約に沿ってPython連携を個別に検討・検証する。

少なくとも次の回帰testを追加する。

- 三つの形式と名前付きexport形式で、Matraから呼び出した結果が`60`になること。
- 単なるparse成功だけでなく、生成モジュールとMatraの文書出力を検証すること。
- 同じ公開名、重複仮想パス、不正パス、欠けたモジュール・exportを拒否すること。
- 引数ヘッダー形式の`return`文、複数の文、不正なJavaScriptを拒否し、
  別形式へのfallbackや暗黙の成功にしないこと。
- 説明用ブロックを実行せず、ブロック順を変えても依存関係に従うこと。
- 例外、非同期処理、初期化失敗が、定めた契約と元のMarkdown位置で通知されること。
- comment、改行、delimiter、短縮形とモジュール形式の境界を検証すること。
- 既存のMatra文書とcompiler sourceのfence選択・実行を維持すること。

parser、AST/data model、lowering、runtime、diagnosticの影響を個別に確認し、
不要な層を変更しない。互換性を壊す実装ではv0.xの破壊的変更と明示し、
影響を受けるexamples、tests、README、migration文書を列挙する。
compiler/bootstrapへ影響する場合はRust seedとStage 1/2/3を検証し、
Stage 2/3の生成Wasmのbyte equalityを維持する。
