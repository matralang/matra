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

## ビルドツールの初期導入経路

最初の配布は、固定versionのNode.js、Matra起動コマンド、CLIと依存ライブラリ、
compiler Wasmと対応manifest、テンプレートとCSS、ライセンス・バージョン情報を
OS・CPU別のフォルダー（ZIPなど）へまとめる方針です。
macOS / arm64向けの開発用フォルダー・ZIP作成と展開検証を追加しました。
公式Node.js `24.17.0`のchecksumを固定し、実行時依存、起動コマンド、
compiler、テンプレート、CSS、ライセンス、version情報を同梱します。
利用側のNode.js・pnpm・Rustなしでinit/build/devが動くことを、空のPATHで検証します。
他のOS・CPU向け同梱配布、署名・公証、releaseへのアップロードは未実施です。
ZIPのbyte再現性は保証せず、source commit・dirty状態・lockfile checksumを記録します。

先行して`@matra/cli`の`matra init DIRECTORY`と最小の`matra build`を追加しました。
新規ディレクトリへ`index.md`、編集可能な`matra.css`、CSSライセンス、`.gitignore`を生成し、
設定ファイルやプロジェクト内のnpm依存を要求しません。
`matra dev`はlocalhost限定のHTTPサーバーと入力3ファイルの変更監視・再buildを提供します。
初回build失敗は起動を中止し、起動後の失敗はdiagnosticとHTTP 503で通知して修正を待ちます。
ブラウザ再読み込みは手動で、Ctrl+Cで停止します。自動リロードは含めません。
buildは現在のディレクトリの文書を既存literate APIでcompile・実行し、
`dist/index.html`とCSS・ライセンスを出力します。信頼する文書のみを対象とします。
Matra Program・compiler sourceの文法、compiler ABIは変更しません。
開発版の利用手順と検証コマンドは[README](../README.ja.md#matraのビルドツール開発版)に記載します。

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
| `@matra/core/experimental/literate` | 公開サブパス・型定義、build/run、同梱compiler、`matra-literate` CLIを実装。Core `0.3.0-alpha.1`をnpm `next`で公開済み。pack検証と6構成remote CIが成功 | P0：利用者への提供経路 | Node.js向け実験的API、FrontMatter設定、compiler Wasm同梱、通常のCore入口との依存分離、同じAPIを使うCLI、checkout外で動く導入作例 | ブラウザ対応、独自の評価系、一般的なsandbox保証、独立npm packageへの分離 |
| `@matra/math` | MathJSON変換、object形式、Content MathML MVP、Morphion型 | P1 | 文書Morphionとの役割の区別、表現境界・保持する意味・制限を説明し、対応する数式を代表例で往復検証 | MathML全体、MathML 4、全数学的同値性の判定 |
| `@matra/math-compute-engine` | 評価・簡約・数値化、Morphion化、property評価 | P1 | 有限和・同類項・関数原子・負の整数冪・256項制限の検証。ゼロ除算などの定義域と順序の再現性を確認 | engine非依存の完全な数式処理、一般式の同値判定 |
| `@matra/styles` | no-class CSSと少数の補助class | P0：検証経路に必要な範囲 | 生成ページとCSSを同梱し、ネットワーク不要で読める出力を確認 | 新しいdesign system、theme拡充 |
| `@matra/graphics` | SVG renderer、shape、defs、filter、legacy drawing API | P1 | 既存SVG作例の再現と、必要ならHTMLへの1つの図の埋め込み | Canvas/WebGL、animation、legacy APIの拡張 |
| `@matra/command` | plan・明示認可・process実行、JSON/NDJSON、Node/Worker adapter | P1 | 現行文法から計画を作る正しいAPI例、必要な場合だけJSON入出力の単一コマンド | Python package統合、任意processの隔離保証、新しいworkflow system |
| `@matra/kernel` | Jupyter protocolとHTML/SVG/AST表示、現在の評価は静的取得 | P2 | 既存テストを維持し、対応範囲を実際のJupyterで検証する | 持続するMatra session、完全なNotebook/Colab体験 |
| `matra-vscode` | highlight、format、outline、簡易diagnostic | P1：現行文法 / P2：新機能 | 標準文法の検証サンプルをformatして壊さないことを確認 | LSP、完全な型推論、旧directive中心の新機能 |
| 別repositoryの公式website（`apps/website`は旧site） | 公式siteにも旧parser API・旧構文と隣接checkout依存が残る。下記は初期調査であり動作検証は未実施 | P0：日英の利用者入口と現行仕様への整合 / P1：新システムへの移行 | 一般向けの日英ページ、導入・作例・白書への導線、Playgroundのv0.3対応方針を整える。静的ページ生成とbrowser実行を分けて移行を検証する | Playground試作前の全面移行確約、Node.js向けliterate APIのbrowser対応、新しい汎用site generator |

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
Core browser entrypointを含むportable runtime CIはcommit `6b78dd4`で成功し、
Windows/macOS/Linux・Node.js 22/24の6構成すべてでCore testとpacked literate配布検証を通過しました
（[GitHub Actions run 40969391013](https://github.com/matralang/matra/actions/runs/40969391013)）。
応用経路のtestとpacked配布検証も、後続commit `1578bd1`の6構成で成功しました
（[GitHub Actions run 40974296046](https://github.com/matralang/matra/actions/runs/40974296046)）。
公式websiteの日英ページ、Playground、表示・操作確認は後述のwebsite完了記録に分けて記載します。

literateの配布検証では、Rustを参照できないPATHと存在しないbootstrap cacheで初回利用を確認します。
同梱Wasmの欠落・破損、非対応bundleの拒否も検証します。compilerは111,064 bytesで、
manifestにversion・SHA-256・ABIを記録し、build時にStage 2/3のbyte一致を確認します。
同じCI runでは対応する全OS/Nodeのpacked literate配布検証も成功しました。

## 公式website：日英の入口と新システムへの移行

### website向け先行配布

`@matra/core`と`@matra/html`は`0.3.0-alpha.0`を先行配布用versionとし、
npmの`next`タグで公開する。これは正式なv0.3公開ではなく、websiteで公開APIと配布物を
検証するための準備である。versionの更新だけではnpm公開済みとは扱わない。
既存の`latest`タグは変更しない。他のpackageは今回の公開対象に含めない。

公開前に`pnpm run lint`、Core・HTMLのtest、`pnpm test:literate:package`を実行する。
配布検証ではversion、HTMLのCore peer dependency、同梱compiler manifestのversionも確認する。
release記録に対応するcommitとCI結果を残し、npm認証と公開権限を確認してから、
Core、HTMLの順で公開する。

```sh
pnpm --filter @matra/core publish --tag next --access public
pnpm --filter @matra/html publish --tag next --access public
npm view @matra/core@0.3.0-alpha.0 version dist.integrity
npm view @matra/html@0.3.0-alpha.0 version dist.integrity peerDependencies
npm view @matra/core dist-tags --json
npm view @matra/html dist-tags --json
```

公開後はregistryから取得したpackageでも文書→HTML生成を再検証し、tarball integrityと
同梱compiler manifestをrelease記録へ対応づける。websiteは両packageを
`0.3.0-alpha.0`へ固定してlockfileを管理する。`next`は移動するタグなので、
再現性が必要な依存指定には使用しない。

#### alpha.0公開記録

2026年10月30日（日本時間）にCore・HTMLの`0.3.0-alpha.0`をnpmの`next`タグへ公開した。
公開元は[`930d378`](https://github.com/matralang/matra/commit/930d3780d02ff9ca9c4bbfea4b9101da51dfbd6d)、
対応tagは`v0.3.0-alpha.0`である。このtagはCore・HTMLの先行配布だけを示し、
他のpackageや公式websiteの完成を示さない。
[対応CI](https://github.com/matralang/matra/actions/runs/40959292210)は
Windows/macOS/Linux × Node.js 22/24の6環境すべてで成功した。
ローカルでもlint、Core 247件・HTML 9件・Web出力1件と配布検証が成功した。

npmから両packageをcheckout外の空projectへ導入し、静的HTML・base path・文書→HTML・CLIを
検証した。実行時はPATHを空にし、存在しないbootstrap cacheを指定してRustなしの動作を確認した。
registryのtarball integrityは公開前に検証したtarballと一致した。
`latest`はCore `0.2.1`、HTML `0.1.0`を維持している。
registry配布物の実行確認はmacOS・Node.js 24.17.0で行い、全OSのregistry導入確認とは区別する。

```text
@matra/core@0.3.0-alpha.0
integrity: sha512-JQa+0M05E9squGXE2O/+VJgvFKLVLWnVGlE8iPitFzI9VnB3Sqxla4bzL5HHdzLIsgHC/ZoHWpQVQkWx3lTElA==
@matra/html@0.3.0-alpha.0
integrity: sha512-CtxcF6t8o/6HBvZhuMb4eyetHQNDMCNAIGBjCyn7++Wlxlk/CSrE/9cf3757RxyxTnQt15cuPRVAPYrb0Tpo/w==
compiler version: 0.3.0-alpha.0
compiler ABI: matra-value-1
compiler bytes: 111064
compiler SHA-256: c9778e9e641bf82031b7fb5c0658dce2167d833c31487409cbdcac09fbad2efd
compiler source SHA-256: 14bf69578be0b705a83942ddfdcf6ada34eb0dfd519702daad6051a6ad6e10c6
Stage 2/3: byte-identical
```

website側ではCore `0.3.0-alpha.1`とHTML `0.3.0-alpha.0`を固定して導入する。
Graphics・Math系の依存移行は別途必要である。

```sh
npm install --save-exact @matra/core@0.3.0-alpha.1 @matra/html@0.3.0-alpha.0
```

2026年10月29日に追加したv0.3タスクです。実装先は
[`matralang/website`](https://github.com/matralang/website)とし、monorepoの`apps/website`を
公式siteとして作り直しません。[白書](./whitepaper-v0.3.ja.md)は技術的な根拠を担い、
websiteは一般の読者が「何に使えるか」「何ができあがるか」から理解できる入口にします。
以下に作業計画を示し、完了実績は後段の記録へ分けて記載します。

### P0：一般向けの日英コンテンツ

- トップと「Matraとは」を日英で用意し、用途・完成例・現在の開発段階を伝える。
  AST・Morphion・Wasmの説明を前提にせず、必要な読者を白書へ案内する。
- 「書く文書」と「生成されるページ」を対にした短い作例を示し、
  導入手順・実行できる作例・白書・仕様へ接続する。未実装機能は区別する。
- 対応するページ間の言語切替、navigation、文書の言語情報を整え、
  日英で手順・対応範囲が食い違わないようにする。
- 既存URLとGitHub Pagesのbase pathを確認し、URLを変える場合は移行導線を用意する。
  モバイル表示、keyboard操作、リンク、掲載コードと出力を検証する。

### P1：新システムでのサイト生成

「新システム」は現行v0.3の文書構築と、Node.js向けの
`@matra/core/experimental/literate`によるbuild/run、`@matra/html`によるHTML出力を指します。
まず日英の代表ページをMarkdownの説明・名前付きfence・明示入口で生成し、
共通レイアウト・navigation・CSS・静的asset・base path・再現性を確認します。
Node.jsはbuild時に使用し、生成した静的siteをGitHub Pagesへ配信します。
任意のJavaScript module連携やbrowser向けliterate APIを新たな前提にしません。

公式websiteの初期調査基準は
[`42d663f`](https://github.com/matralang/website/commit/42d663f4a6557808e0a50adec073fc4f7ddd6505)です。
`src/build.ts`は旧`parse()`の結果を直接rendererへ渡し、
`src/client/core-browser.ts`とbrowser bundleは隣接するMatra checkoutの内部出力を参照します。
依存定義にも`file:../matra/...`があるため、配布packageまたはCIで明示的に固定したsourceから
再現できるbuildへ移行する必要があります。使用するversion・commit・compiler artifactを記録し、
開発者のdirectory配置へ暗黙に依存しないことを確認します。

### Playgroundを先に小さく検証する

Playgroundの画面を新システムで生成することと、入力コードをbrowserで実行することは別タスクです。
現行siteの`src/client/playground.ts`には旧parseオプションと、parse結果を文書ASTとして扱う経路、
旧構文の作例があります。新しいNode.js向けliterate APIをそのままbrowserへ持ち込む案は採用しません。

1. 既存のHTML・SVG・Math・JavaScriptモード、作例、preview、診断、copy/downloadを棚卸しし、
   維持・移行・延期の範囲を明記する。
2. 現行v0.3のparse→静的取得または明示評価→文書AST→出力をbrowserで試作する。
   Mathは独自のdomain経路として検証する。Wasmが必要な場合だけcompiler・hostのbrowser適合性を別途確認する。
3. 明示的な実行操作、実行中表示、Worker等による停止・再実行、期限超過・構文／実行エラーの表示、
   previewの隔離を検証する。無限loopでUIが固まらないことを確認し、一般的なsandbox保証とは区別する。
4. HTML・SVGの代表例と不正入力・停止操作を実browserで確認し、初回読込量・起動時間・実行応答を計測する。
   計測結果と許容基準を記録してから全面移行の可否と範囲を決める。

全面移行できる場合も、静的コンテンツの生成とPlaygroundのclient assetを分離して配信できます。
browser実行に追加の大きな基盤改修が必要なら、日英コンテンツの公開を先行し、
Playgroundは現行v0.3で検証できた限定モードだけを提供するか、未対応であることとローカル作例を明示します。
旧文法を現行v0.3として見せる状態は残しません。機能を減らす場合は対象と代替導線を記録します。
全面移行の延期理由・残作業はrelease noteへ記載し、未達を成功扱いにしません。

#### alpha.1 browser entrypointの公開記録

`@matra/core@0.3.0-alpha.1`を2026年10月30日（日本時間）にnpmの`next` tagへ公開した。
公開versionは`npm view`で確認し、`latest`は`0.2.1`のまま、`next`は`0.3.0-alpha.1`である。
公開時のregistry integrityは次のとおり。

```text
@matra/core@0.3.0-alpha.1
integrity: sha512-KmSsuLfkwOeHaK9bLjrSN7r/MesBlhzrkiS8JPIzAnmAKQSDC4+t0Ifldh1oYZ7yNHWC8f8bSo4f01bAMr6iIA==
exports: ., ./browser, ./experimental/literate
```

`./browser`はNode.js file loaderを含めず、parse・明示評価・文書AST変換を提供する。
Coreの公開entrypoint追加（`83e2891`）、alpha.1 version準備（`1aa7540`）後に公開した。
Core testとpacked-package検証は成功した。公開versionのpack済み実行をmacOS・Node.js 24で確認した。
他OSのregistry導入検証やremote CI成功とは区別する。

#### website / Playground試作の完了記録

2026年10月30日に公式websiteを`matralang/website` commit `aaab33a`で更新した。
日英のPlaygroundは現行Core browser APIとHTML rendererを使い、明示実行、Worker停止、
10秒timeout、syntax/runtime error表示、空のsandbox属性を持つiframe previewを提供する。
同期loopの手動停止とtimeout、再実行、構文・実行error、preview内scriptの不実行と
CSPによる外部image requestの拒否をIntegrated Chromiumで確認した。
SVG・Math・JavaScript module import・copy/downloadは延期し、Node.js作例を代替導線とする。
Worker/iframeは一般的なsecurity sandboxではないことを日英で明示する。

ローカル検証では`npm ci`、`npm test`、`npm run build`とbase path・内部link・
再現性のtestが成功した。client bundleは3,374 bytes（gzip 1,464 bytes）、
Worker bundleは17,588 bytes（gzip 5,722 bytes）。Playground合計の目標をgzip 32 KiB以下、
代表的な短い文書のWorker開始から結果受信を100 ms未満とし、この環境では初回25 ms、
続く4回16–18 msを観測した。これはlocalhostの単一browser環境における試作基準であり、
network、device、全対応browserに対するperformance保証ではない。

**Playground完了判定**：限定したHTML modeを採用し、SVG・Math等の全面移行は延期する。
機能、診断、停止、timeout、iframe制約、日英導線、bundle量、応答時間を検証し、
非対応範囲とNode.js代替導線を記録したため、下記release checklistのwebsiteとPlayground項目を完了とする。

#### SVG・数式・編集の応用経路検証記録

Node.js 24で`@matra/graphics`（16件）、`@matra/math`（24件）、
`@matra/math-compute-engine`（15件）、VS Code editor（8件）の既存testが成功した。
Graphics、Math、Compute Engineを`pnpm pack`し、一時的なconsumerへ3つのtarballと
公開済み`@matra/core@0.3.0-alpha.1`を導入して実行した。SVGの生成、MathJSONのparse、
Content MathMLのserialize/normalize、`evaluateMatra("Add(1, 2, 3)") === 6`を確認した。
生成済み`basic.svg`はIntegrated Chromiumで表示を確認した。
さらにportable runtime CIにGraphics 16件、Math 24件、Compute Engine 15件、VS Code editor 8件のtestと、
tarballを一時npm consumerへ導入する検証を追加し、Windows/macOS/Linux・Node.js 22/24の全6構成で成功した。
consumerではSVG生成、MathJSON parse、Content MathMLのserialize/normalize、数式評価と、
editor packageのmanifest・grammar配布を確認した（[run 40974296046](https://github.com/matralang/matra/actions/runs/40974296046)）。
SVGの実際のbrowser表示確認はmacOS・Node.js 24のIntegrated Chromiumで行った。
Content MathMLは意味表現の検証であり、browserによる数式の視覚表示を確認したとは扱わない。
editorはpackage内の資産と既存testを検証しており、VS Code hostを起動した統合操作検証ではない。

#### Release candidate検証baseline（公開前）

2026-10-30時点の候補sourceを次のcommitへ固定する。

- Core: `c66434132f7d6cf02e919f1e5fb5fd181c61ffc1`
- Official website: `e51f2cd88377838e74ca895dc5edc9e6d9d26410`

websiteの`npm run lint`、`npm test`、`npm run build`はwebsite commitで成功した。
Coreのportable runtime CIはCore commitで成功し、Core・applied-route package test、
packed consumer、portable runtime、Stage 2/3 bootstrap、HTML生成をWindows/macOS/Linux・
Node.js 22/24で検証した（[run 40975233046](https://github.com/matralang/matra/actions/runs/40975233046)）。

websiteが利用する公開依存は`@matra/core@0.3.0-alpha.1`
（npm integrity `sha512-KmSsuLfkwOeHaK9bLjrSN7r/MesBlhzrkiS8JPIzAnmAKQSDC4+t0Ifldh1oYZ7yNHWC8f8bSo4f01bAMr6iIA==`）
と`@matra/html@0.3.0-alpha.0`
（npm integrity `sha512-CtxcF6t8o/6HBvZhuMb4eyetHQNDMCNAIGBjCyn7++Wlxlk/CSrE/9cf3757RxyxTnQt15cuPRVAPYrb0Tpo/w==`）で固定している。
Core compilerは`0.3.0-alpha.1`、ABI `matra-value-1`、111,064 bytes、
SHA-256 `c9778e9e641bf82031b7fb5c0658dce2167d833c31487409cbdcac09fbad2efd`で、
manifestはStage 2/3 byte equalityを記録する。

公開対象はCore + HTMLとし、両packageの正式versionを`0.3.0`とする。
`@matra/styles@0.1.0`はP0表にあるが、workspace内に存在する一方、2026-10-30のnpm照会では
packageが見つからなかった（E404）。websiteはCSSを同repository内に持ち、外部stylesheet downloadなしでbuildするため、
Styles package自体は今回のnpm公開対象から除外する。P1/P2 packageも今回の公開対象に含めない。
正式公開と`latest` tag更新は、release sourceの再検証と追跡可能なGit release記録を確認後に行う。

これは検証済みsource・配布物の候補baselineであり、公開用のv0.3 RC tagやnpm releaseではない。
npmの`next`/`latest` tagとwebsiteの公開deployは変更していない。
ここに記録したCore/HTML `0.3.0`は公開候補versionであり、registryには未公開である。
websiteの依存は検証時点のalpha versionのままであり、website deployも行っていない。

## 実装段階と完了条件

| 段階 | 作業 | 完了の証拠 |
| --- | --- | --- |
| 1：基準確認 | 全packageの現状監査、古いAPI例の修正、文書→HTMLの検証サンプル | build/test/lintの基準結果、生成HTMLと回帰test |
| 2：基盤整備 | 文書Morphion契約と実装の照合、文書・JavaScript連携の不具合修正 | モデルの契約、受理・拒否・定義域のtest、再現できる手順 |
| 2から3への配布準備 | build/runの公開契約、compiler Wasm同梱、Coreのサブパス・型定義・CLIの整備 | 公開export、通常入口との依存分離、対応ABI、compilerのversion/checksumと容量、初回利用と失敗時のtest |
| 3：応用経路 | SVG・数式・編集環境の既存機能を代表例で検証、配布物を試す | packageされた状態でのサンプル実行、実際の表示、対応OSの検証 |
| 3：website | P0の日英入口と現行仕様への整合、P1の代表ページ生成・Playground試作と移行判断 | 日英ページ、掲載例の実行、リンク・表示・言語切替の確認、browser試作の計測・停止test、採用範囲と延期理由 |
| 4：release候補 | 文法/APIと検証サンプルを固定、v0.3候補を検証 | 固定commit、version・checksum、release note、Stage 2/3一致、CI成功 |
| 5：公開判定 | 下記の必須条件と既知の制限を照合し、実験版v0.3を公開 | Core/HTML `0.3.0`のregistry配布物・tagを検証し、固定版での再現性、導入・取得手順、仕様と実装の一致を確認 |
| 6：公開後 | 導入手順・ドキュメント・不具合の修正、必要ならpatch release | 変更履歴と再検証の結果 |

P1/P2は完成した範囲をrelease noteへ記載し、未完成の拡張をP0の公開条件に追加しません。
P0が未達の場合は、「実験的」という名称だけで成功扱いにせず、完成範囲を再判断します。

## release判定のチェックリスト

- [x] 文書モーフィオンの対応規則・相互変換・未定義の演算を仕様とテストで明確にする
- [x] 検証サンプルのsource、実行command、出力例が固定commitに対応する
- [x] `pnpm run build`、`pnpm test`、`pnpm run lint`、`pnpm test:web-page`が成功する
- [x] `pnpm bootstrap:verify`でStage 2/3の生成Wasmがbyte単位で一致する
- [x] 検証サンプルをNode.js 22/24で確認し、Windows/macOS/Linuxで同じHTMLを得る
- [x] 公開対象のpackageをpackし、別の空のprojectから導入して検証サンプルが動く
- [x] literateの公開API・型定義・error契約を実装し、内部相対importやcheckout依存なしでbuild→run→HTML生成できる
- [x] compiler供給方式と対応ABI、ネットワーク・Rustの要否を明記し、キャッシュのない初回利用も検証する
- [x] compiler Wasm・checksum・ソース・実行hostの取得手順を固定する
- [x] 公式websiteに一般向けの日英の入口・作例・導入導線を用意し、README・仕様書と対応環境・依存関係・制限を再照合する。`matralang/website` commit `66970b3`・`aaab33a`、`npm ci`・`npm test`・`npm run build`、browser計測を記録
- [x] Playgroundの現行v0.3対応範囲をbrowserで確認し、非対応機能と代替導線を明示する。HTML modeを採用し、SVG・Math・JavaScript module等の全面移行は延期。測定値と延期範囲を本節へ記録
- [x] Graphics・Math・Compute Engineをpackし、一時consumerでSVG・MathJSON・Content MathML・評価の代表例を実行する。macOS・Node.js 24のローカル結果として記録
- [x] Graphics・Math・Compute Engine・editorの既存testとpacked配布物の代表例をWindows/macOS/Linux・Node.js 22/24で検証する。commit `1578bd1`、[run 40974296046](https://github.com/matralang/matra/actions/runs/40974296046)の6構成が成功。SVGのbrowser表示はmacOSで確認し、Content MathMLの視覚表示とVS Code host操作は未検証として区別
- [x] Core browser entrypointとpacked literate配布物をWindows/macOS/Linux・Node.js 22/24でremote CI検証する。commit `6b78dd4`、[run 40969391013](https://github.com/matralang/matra/actions/runs/40969391013)の6構成が成功
- [x] release candidateのsource baseline、website/npm dependency integrity、compiler checksum/ABI、CI結果を記録する。Core `c664341`、website `e51f2cd`。これは公開RC tagやnpm releaseではない
- [x] 未実装の`.js` module・npm/Python連携と汎用`.jsonm`を実装済みとして説明していない
- [x] Core + HTML `0.3.0`を公開し、npm `latest` tag、registry integrity、空のconsumerでの生成経路を確認する。StylesおよびP1/P2 packageは対象外

既存の[portable CI](https://github.com/matralang/matra/actions/runs/40418928782)は調査基準commitで成功しています。
これは検証用HTML・全package・公開済み配布物の検証完了とは別です。
追加したweb-page CIはJavaScript依存の導入からHTML生成・検証までを3 OS×Node.js 22/24で行います。
CIの設定を追加したことと、そのCIがremoteで成功したことも区別して記録します。

## v0.3.0公開記録

2026年10月30日（日本時間）、CoreとHTMLの`0.3.0`を公開し、npm `latest`を両方とも
`0.3.0`へ更新しました。tag `v0.3.0`はrelease source commit
[`ca58218`](https://github.com/matralang/matra/commit/ca5821880c84e4ed0eefb6b27a4882e2ed319b79)
を指し、同commitの[portable CI](https://github.com/matralang/matra/actions/runs/40977745555)は
Windows/macOS/Linux × Node.js 22/24の6構成すべてで成功しました。

```text
@matra/core@0.3.0
integrity: sha512-01WmTtplQny66tWI7CPrpWlKYVhzJ1AaAgE/gQA86ccx1/09Vjo+J8BM4Bkm1a2rgDJHMxnFeeLZlaYLvQDfuQ==
@matra/html@0.3.0
integrity: sha512-dceZgfOFMYOmvWIUVCeo7/V6NWfeWGNYdE6FLcxM/g5LWpQcmZFwGc/8sxmsbITju40wQCpSlLOGDKNcFwGPxg==
HTML Core peer dependency: ^0.3.0
Core compiler: 0.3.0, ABI matra-value-1, 111064 bytes
compiler SHA-256: c9778e9e641bf82031b7fb5c0658dce2167d833c31487409cbdcac09fbad2efd
npm latest: Core 0.3.0, HTML 0.3.0
npm next: Core 0.3.0-alpha.1, HTML 0.3.0-alpha.0
```

ローカルでは`pnpm run lint`、Core 250件、HTML 9件、literate package、
applied-route packed consumer、web-page testが成功しました。さらに空の一時consumerへregistryから
両packageをexact versionで導入し、Node.js 24.17.0でdocument→HTMLとliterate build/runを確認しました。
正式公開範囲はCore + HTMLです。StylesとP1/P2 packageは公開していません。
websiteの依存versionは検証時のalpha pinのままで、website deployも行っていません。
