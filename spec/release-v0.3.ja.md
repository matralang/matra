# v0.3：完成範囲案とrelease条件

[English](./release-v0.3.md) | [日本語](./release-v0.3.ja.md) | [索引](./README.ja.md)

## 目的

v0.3は、モーフィオンに基づく文書モデル、既存言語との明示的な接続、
クリエイティブなシステムに使える出力経路を整える実験版です。
基盤の一貫性、既存実装の完成度、依存関係、検証可能性から優先度を定めます。
調査基準はdevelopの`1a4b65fd108248bd7e6b917c37ed3130d24a2537`です。

最初の検証経路は、文書の記述からJavaScriptの値・関数の接続を経て、
再現可能なHTML・CSSを生成する流れとします。この経路を用いて各層の接続を確認します。
仕様v0.3、各npm packageのversion、compilerのABIは別管理です。
全packageを一律に完成扱いにせず、対応する経路と検証環境をrelease noteに明示します。

## 思想と完成の判断基準

| 思想 | v0.3で確認すること |
| --- | --- |
| モーフィオンに基づく数学モデル | Matra ASTの構造を項の有限な表現として捉え、指数0をtag、正整数nをchildren[n - 1]、文字列keyをprops[key]へ対応させ、文書の意味を保って往復する |
| 既存言語を尊重するラーニング | JavaScriptの配列・object・関数を本来のJavaScriptとして使い、Matra側の公開名・値境界を明示する |
| クリエイティブなシステム | 説明とコードを含む文書からWebページを生成する。SVGと数式処理は代表的な創作経路として検証する |

定義を[文書data model](./data-model.ja.md#モーフィオンとの対応)へ反映しました。
ここでのMorphionは、Matra ASTを独立した数学モデルとして一貫して扱うための概念です。
nodeをtag・ordered children・keyed propertiesの組として見る代わりに、各要素を指数で位置づけた
有限な対応関係として見ます。項列は「指数から係数`val`への有限写像」の表記であり、指数は
node内の位置またはkeyを一意に示します。この対応により、childの順序、propertyのkey、値の型と内容を
保ったままASTとMorphionを相互に復元できます。source positionは構文解析時の付随情報なので、
この対応には含みません。

Coreの`MatraMorphion`はnode単位の表現です。子nodeは係数内で既存の文書ASTとして保持し、
そのnodeにも同じ対応を再帰的に適用できます。一方、配列やmapの内容はnodeとして再解釈しません。
数値指数と文字列指数は別の領域であり、たとえば数値`0`はtag、文字列`"0"`はproperty keyです。
文書上の位置やkeyを表すため、係数の`0`や空値も通常の値として保持します。

これは数式の多項式展開を意味せず、項の加算・乗算、同類項の整理、零項の除去などの演算も定義しません。
この文書Morphionの概念と対応規則はv0.3で導入しますが、Matraの文法・評価・compiler ABIは変更しません。

既存のCompute Engine adapterの`MorphionForm`は数式展開の派生表現です。
今回の文書モデルとは分けて扱います。Content MathML/CDは意味の交換、MathJSONはengineとの交換、
数式のMorphionFormは基底・指数vector・係数による項構造の表現を担います。
両者は項・指数・係数という語を共有しますが、文書Morphionの指数はAST内の位置/keyであり、
数式Morphionの指数は基底に対する冪です。名前が共通していても、意味や演算規則を共有するものではありません。

## パッケージと実装の優先度

P0はreleaseの必須条件、P1は既存実装の限定範囲を整備・検証する対象、
P2は動作を維持するが新しい完成条件を増やさない対象です。
基盤、言語間連携、創作の出力経路の順に、依存関係を踏まえて完成させます。
表はソース調査に基づく評価です。

| 対象 | 現状の実装 | 優先度 | v0.3で完成させる範囲 | 今回は約束しない範囲 |
| --- | --- | --- | --- | --- |
| `@matra/core` | v0.3 parser、静的取得・明示評価、文書AST、変換・走査、JSONMatra補助API。今回、文書Morphion相互変換を追加 | P0 | 文書Morphionの往復・指数検証、Moduleと文書ASTの区別、文書構築・loop・JS接続経路、現行APIで動くREADME、診断の制限を明記 | 汎用`.jsonm`、全APIで統一したsource map、厳密な型システム |
| `@matra/html` | escaping、void element、pretty出力、base path | P0 | 完全なHTML文書、本文・属性・値のescape、JSデータからの繰り返しを検証サンプルで検証 | Web framework全体、hydration、汎用site generator |
| literate host / `matra-seed` | Rust seed、Matra製Wasm compiler、明示入口と`.js.part`、JSON bundle、portable file API | P0 | 検証文書のbuild→実行→HTML出力、元文書の診断、bootstrapのStage 2/3 byte equalityを維持 | 標準`.js` module/npm/Pythonの直接import、standalone runtime・package manager |
| `@matra/core/experimental/literate` | 公開サブパス・型定義、build/run、同梱compiler、`matra-literate` CLI、pack検証を実装。npm公開とremote検証は未完了 | P0：利用者への提供経路 | Node.js向け実験的API、FrontMatter設定、compiler Wasm同梱、通常のCore入口との依存分離、同じAPIを使うCLI、checkout外で動く導入作例 | ブラウザ対応、独自の評価系、一般的なsandbox保証、独立npm packageへの分離 |
| `@matra/math` | MathJSON変換、object形式、Content MathML MVP、Morphion型 | P1 | 文書Morphionとの役割の区別、表現境界・保持する意味・制限を説明し、対応する数式を代表例で往復検証 | MathML全体、MathML 4、全数学的同値性の判定 |
| `@matra/math-compute-engine` | 評価・簡約・数値化、Morphion化、property評価 | P1 | 有限和・同類項・関数原子・負の整数冪・256項制限の検証。ゼロ除算などの定義域と順序の再現性を確認 | engine非依存の完全な数式処理、一般式の同値判定 |
| `@matra/styles` | no-class CSSと少数の補助class | P0：検証経路に必要な範囲 | 生成ページとCSSを同梱し、ネットワーク不要で読める出力を確認 | 新しいdesign system、theme拡充 |
| `@matra/graphics` | SVG renderer、shape、defs、filter、legacy drawing API | P1 | 既存SVG作例の再現と、必要ならHTMLへの1つの図の埋め込み | Canvas/WebGL、animation、legacy APIの拡張 |
| `@matra/command` | plan・明示認可・process実行、JSON/NDJSON、Node/Worker adapter | P1 | 現行文法から計画を作る正しいAPI例、必要な場合だけJSON入出力の単一コマンド | Python package統合、任意processの隔離保証、新しいworkflow system |
| `@matra/kernel` | Jupyter protocolとHTML/SVG/AST表示、現在の評価は静的取得 | P2 | 既存テストを維持し、対応範囲を実際のJupyterで検証する | 持続するMatra session、完全なNotebook/Colab体験 |
| `matra-vscode` | highlight、format、outline、簡易diagnostic | P1：現行文法 / P2：新機能 | 標準文法の検証サンプルをformatして壊さないことを確認 | LSP、完全な型推論、旧directive中心の新機能 |
| `apps/website`と別repositoryの公式サイト | monorepoに旧siteが残り、READMEは公式siteの別管理を明記 | P1：利用者の入口 | 公式ドキュメントとv0.3の導入・実行手順を一致させる。別repositoryは別途監査する | 旧siteを根拠に公式siteの更新済みを宣言すること |

公開APIと配布条件は[literateの公開API契約](./literate-modules.ja.md#v03の公開api配布契約)で定めます。
既存P0経路の正しさ・値境界・diagnostic・bootstrapを先に保ち、同梱compilerの生成・検証手順を
整えてからサブパスと導入作例を完成させます。P1/P2の拡張より優先しますが、現在の内部関数を
npm公開済みとは扱いません。独立package化は将来に延期し、CLIは`matra-literate`として提供します。

## 最初の検証サンプル

[Webページの実行文書](../packages/html/examples/web-page.md)を追加しました。

```text
pnpm install --frozen-lockfile
pnpm example:web-page
pnpm test:web-page
```

Matraの文書構築と明示展開、JavaScriptのデータ・集計・表示関数、Wasm実行、
HTML出力、同梱CSSまでを1つの実用サンプルで通します。
文書MorphionはASTの数学モデルとしてCoreと仕様で定義・検証し、このHTML生成経路では不要なため変換しません。
記事内容は架空データで、数式展開用Morphionの計算は行いません。
Node.js 22/24と指定のRust toolchainを前提とします。

出力は`packages/html/examples/dist/index.html`と`matra.css`です。
HTMLの言語・文字コード、3件の展開、合計24分、文字列のescapeを回帰testで確認します。
生成後の閲覧はオフラインでできます。
作例は公開サブパスをimportし、`pnpm test:literate:package`ではCoreとHTMLをpackして
checkout外の空projectからAPI・CLI・型定義・HTML生成を検証します。
現在のRust要件はrepository内のbootstrap経路に対するものです。公開予定のサブパスは
同梱compilerを使い、利用者のRustやcompilerの追加downloadを不要にします。

## 検証状況

初回のローカル検証で全体のbuild・lint・testが成功しました。
Coreは追加6件を含む241件、HTMLは9件、Rust seedは28件、compiler/hostのJavaScript testは281件です。
他のworkspace packageの既存testも成功しています。Webページの統合testは別commandで1件成功しました。
通常のHTML package testにRustの要件を増やさないよう、統合testは`pnpm test:web-page`で明示実行します。
READMEの静的文書・テンプレート・関数/loopの例も実行してHTML出力を確認しました。

追加したCoreと検証サンプルはNode.js 24.17.0で直接検証しています。
新しいCIのremote実行、他OSでの検証サンプル、公式siteの照合、
生成ページの見た目の確認は未完了です。これらを公開前の残作業として扱い、
ローカルtestの成功だけでrelease完了とはしません。

literateの配布検証では、Rustを参照できないPATHと存在しないbootstrap cacheで初回利用を確認します。
同梱Wasmの欠落・破損、非対応bundleの拒否も検証します。compilerは111,064 bytesで、
manifestにversion・SHA-256・ABIを記録し、build時にStage 2/3のbyte一致を確認します。
この結果はローカルのものであり、対応する全OS/Nodeでの配布検証はCIの成功を待ちます。

## 実装段階と完了条件

| 段階 | 作業 | 完了の証拠 |
| --- | --- | --- |
| 1：基準確認 | 全packageの現状監査、古いAPI例の修正、文書→HTMLの検証サンプル | build/test/lintの基準結果、生成HTMLと回帰test |
| 2：基盤整備 | 文書Morphion契約と実装の照合、文書・JavaScript連携の不具合修正 | モデルの契約、受理・拒否・定義域のtest、再現できる手順 |
| 2から3への配布準備 | build/runの公開契約、compiler Wasm同梱、Coreのサブパス・型定義・CLIの整備 | 公開export、通常入口との依存分離、対応ABI、compilerのversion/checksumと容量、初回利用と失敗時のtest |
| 3：応用経路 | SVG・数式・編集環境の既存機能を代表例で検証、配布物を試す | packageされた状態でのサンプル実行、実際の表示、対応OSの検証 |
| 4：release候補 | 文法/APIと検証サンプルを固定、v0.3候補を検証 | 固定commit、version・checksum、release note、Stage 2/3一致、CI成功 |
| 5：公開判定 | 下記の必須条件と既知の制限を照合し、実験版v0.3を公開 | 固定版での再現性、導入・取得手順、仕様と実装の一致 |
| 6：公開後 | 導入手順・ドキュメント・不具合の修正、必要ならpatch release | 変更履歴と再検証の結果 |

P1/P2は完成した範囲をrelease noteへ記載し、未完成の拡張をP0の公開条件に追加しません。
P0が未達の場合は、「実験的」という名称だけで成功扱いにせず、完成範囲を再判断します。

## release判定のチェックリスト

- [x] 文書モーフィオンの対応規則・相互変換・未定義の演算を仕様とテストで明確にする
- [ ] 検証サンプルのsource、実行command、出力例が固定commitに対応する
- [x] `pnpm run build`、`pnpm test`、`pnpm run lint`、`pnpm test:web-page`が成功する
- [x] `pnpm bootstrap:verify`でStage 2/3の生成Wasmがbyte単位で一致する
- [ ] 検証サンプルをNode.js 22/24で確認し、Windows/macOS/Linuxで同じHTMLを得る
- [x] 公開対象のpackageをpackし、別の空のprojectから導入して検証サンプルが動く
- [x] literateの公開API・型定義・error契約を実装し、内部相対importやcheckout依存なしでbuild→run→HTML生成できる
- [x] compiler供給方式と対応ABI、ネットワーク・Rustの要否を明記し、キャッシュのない初回利用も検証する
- [x] compiler Wasm・checksum・ソース・実行hostの取得手順を固定する
- [x] 公式site・README・仕様書の対応環境、依存関係、制限が一致する
- [x] 未実装の`.js` module・npm/Python連携と汎用`.jsonm`を実装済みとして説明していない

既存の[portable CI](https://github.com/matralang/matra/actions/runs/40418928782)は調査基準commitで成功しています。
これは検証用HTML・全package・公開済み配布物の検証完了とは別です。
追加したweb-page CIはJavaScript依存の導入からHTML生成・検証までを3 OS×Node.js 22/24で行います。
CIの設定を追加したことと、そのCIがremoteで成功したことも区別して記録します。
