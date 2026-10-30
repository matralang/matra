# Matra

[English](./README.md) | [日本語](./README.ja.md)

Matraはpnpm workspaceのmonorepoとして管理されています。公開パッケージは
`@matra/*` scopeで提供します。

## 仕様

- [Matra Language White Paper v0.3（日本語）](spec/whitepaper-v0.3.ja.md) — 設計思想、
  文書モデル、実行・出力の到達点と旧実装からの変更。
- [Matra Specification（ソース文法v0.3）](spec/README.md)
- [Matra Specification（日本語）](spec/README.ja.md)
- [v0.3の完成範囲案とrelease条件](spec/release-v0.3.ja.md)

## Webページの検証サンプル

[1つのMarkdown文書](packages/html/examples/web-page.md)に説明・Matraの構造・
JavaScriptのデータと関数をまとめ、HTML文書と同梱CSSを生成します。
Node.js 22/24、pnpm、repository指定のRust toolchainを用意して実行します。

```sh
pnpm install --frozen-lockfile
pnpm example:web-page
pnpm test:web-page
```

`packages/html/examples/dist/index.html`をブラウザで開いてください。生成後はオフラインで
閲覧できます。実装済みの`.js.part`を使う作例で、標準JavaScript module・npm・Python連携は
この経路に含みません。

## Matraのビルドツール（開発版）

`@matra/cli`の`matra init`で、設定ファイルや依存関係を手作業で組み立てずに
最初のページを作れます。macOS・Linux・Windowsのx64 / arm64向けにNode.js同梱フォルダーと
ZIPを各対象環境で作成・検証する開発用スクリプトと6構成のCIを用意しました。
commit `2056aee`の[配布CI run 41005130597](https://github.com/matralang/matra/actions/runs/41005130597)で
6構成すべてのCLI test・ZIP作成・再展開検証が成功しました。
ローカル実動確認はmacOS / arm64でも行っています。署名・公証、releaseへのアップロードは後続です。

Node.js 22/24、pnpm、repository指定のRust toolchainを用意し、repository rootで
次を実行します（PATHの設定例はmacOS/Linux向けです）。

```sh
pnpm install --frozen-lockfile
pnpm --filter @matra/core run build
pnpm --filter @matra/html run build
export PATH="$PWD/node_modules/.bin:$PATH"
matra init hello
cd hello
matra build
```

Windowsではrepositoryの`node_modules/.bin`をPATHに追加し、同じ`matra`コマンドを使います。
生成先は**まだ存在しないディレクトリ**を指定します。空のディレクトリも上書きしません。
親ディレクトリは事前に存在する必要があります。生成するファイルは次のとおりです。

```text
hello/
  index.md           # FrontMatter・Matra・JavaScriptデータを含む文書
  matra.css          # @matra/stylesのCSS。自由に編集可能
  matra.css.LICENSE  # CSSのライセンス
  .gitignore         # /dist/を除外
```

入口は`index.md`、CSSは`matra.css`、出力先は`dist/`に固定しています。
`matra build`は現在のディレクトリで文書をコンパイル・実行し、`dist/index.html`、
`dist/matra.css`、`dist/matra.css.LICENSE`を生成・更新します。
`dist/index.html`はブラウザで直接開け、閲覧にネットワーク接続は不要です。
未知の出力ファイルは削除せず、出力先のsymlinkは拒否します。
build時には文書内のJavaScriptが実行されるため、信頼する文書のみをbuildしてください。
通常のliterate API・`matra-literate` CLI・文法は変更していません。
利用時には同梱compiler Wasmとmanifestを使い、Rust・pnpm・ネットワークは不要です。
現在の開発版の準備とpack検証ではRust・pnpmが必要です。

### ローカルプレビュー

作成したプロジェクト内で実行します。

```sh
matra dev
```

初回build後、`http://127.0.0.1:3000/`をブラウザで開きます。
`index.md`、`matra.css`、`matra.css.LICENSE`の変更を監視して自動で再buildします。
ブラウザの再読み込みは手動です。自動リロードやブラウザの自動起動は行いません。
ポートが使用中ならエラーで終了します。`matra dev --port 3001`で変更できます。
外部公開せず、`127.0.0.1`だけで待ち受けます。
配信対象は生成HTML・CSS・CSSライセンスだけで、文書sourceやその他のファイルは配信しません。

初回buildの失敗は起動エラーとして終了します。起動後のbuild失敗はターミナルに表示し、
配信対象への応答をHTTP 503（plain textのdiagnostic）にします。
前回のファイル出力は残し、修正後の再build成功で配信を再開します。
Ctrl+Cでサーバーと監視を停止します。

`pnpm test:cli`で初期化・HTML/CSS生成・エラー処理を、
`pnpm test:literate:package`でCLI・テンプレート・CSS・compilerをpackして
checkout外・外部コマンドなしでinit/build/devが動くことを検証します。

### Node.js同梱ZIPの作成

作成側にはNode.js 22/24、pnpm、repository指定のRust、`tar`・`zip`・`unzip`と
ネットワーク接続が必要です。Windowsでは`tar`と標準Windows PowerShell / .NETのZIP機能を使い、
`zip`・`unzip`コマンドは不要です。repository rootで依存を導入してから実行します。

```sh
pnpm install --frozen-lockfile
pnpm distribution:build
```

公式Node.js `24.17.0`のアーカイブを取得し、
[固定checksum](packages/cli/distribution/node.json)を検証してから展開します。
Matraのpackageをpackし、実行時依存だけを自己完結したフォルダーへまとめます。
compiler Wasmと対応manifest、テンプレート、CSS、各ライセンス、`versions.json`を含みます。
npm・pnpm自体は同梱しません。

実行しているOS・CPU向けに作成します。cross buildは行いません。
対象は`darwin-arm64`、`darwin-x64`、`linux-arm64`、`linux-x64`、`win32-arm64`、`win32-x64`です。
Linuxは公式Node.jsが対応するglibc環境向けで、Alpine / muslは対象外です。
出力は`dist/releases/matra-0.3.0-TARGET/`、同名の`.zip`と`.zip.sha256`です。
作成中のフォルダーとZIPの再展開先で、日本語・空白を含むパスへの移動、PATHが空の環境での
起動・init/build/dev・変更監視・終了、compilerとライセンスの存在を検証します。
Windowsは`matra.cmd`によるinit/buildと同梱Node.jsによるdevを検証し、
テスト終了時はdevプロセスを終了します（Ctrl+Cの対話操作は自動検証していません）。
既存の成果物は上書きしません。再作成は`pnpm distribution:build --output dist/another-release`
のように別の出力先を指定してください。ZIPのbyte単位の再現性は保証しません。
`versions.json`にはsource commitと作業ツリー変更の有無も記録します。

利用者はZIPを展開し、**展開したフォルダー**をPATHへ追加するだけで利用できます。
起動コマンドは同梱Node.jsを使うため、利用側のNode.js・pnpm・Rust・ネットワークは不要です。
手順は[配布物の説明](packages/cli/distribution/README.ja.md)を参照してください。
実体のフォルダーを指定し、起動コマンドだけを別の場所へ移動・symlinkしないでください。

```sh
export PATH="/absolute/path/to/matra-0.3.0-darwin-arm64:$PATH"
matra init hello
cd hello
matra build
matra dev
```

Windows PowerShellでは、展開したフォルダーを次のようにPATHへ追加します。

```powershell
$env:Path = "C:\path\to\matra-0.3.0-win32-x64;$env:Path"
matra init hello
cd hello
matra build
matra dev
```

展開済みフォルダーは`pnpm distribution:verify dist/releases/matra-0.3.0-darwin-arm64`
で再検証できます。macOSのdownload承認が必要になる場合があります。
開発版のため署名・公証は行っていません。
[配布CI](.github/workflows/distribution.yml)は6つのnative runnerでCLI test・ZIP作成・再展開を行い、
成功したZIPとchecksumを7日間のActions artifactとして保存します。GitHub Releaseへは公開しません。

## 移植性の方針

Matraの中心目標は、共通APIと対応パッケージで作った同じプロジェクトを、
Windows・macOS・Linuxでソースや設定を書き換えずに依存解決・起動・ビルド・実行できることです。
任意の外部CLIとの互換性より、依存関係を含む移植性を優先します。
Android・iOSは当面Web動作または一部サポートを想定します。

これは今後の正式サポートに向けた目標であり、現時点の動作保証ではありません。
現在の資産、保証範囲、未決のAPI設計、段階的な検証計画は
[移植性方針と共通ランタイムのロードマップ](spec/portable-runtime.ja.md)を参照してください。

v0.3の小さな実動版はNode.jsホストを使います。同じサンプルをMatra製compilerでWasmへbuildし、
共通API経由で入力fileの読み込み・Matraでの処理・結果の書き出しを実行します。
Node.js 22/24、pnpm、Rust toolchainを用意し、repository rootで実行してください。

```text
pnpm portable -- build crates/matra-seed/examples/portable main.matra main.wasm
pnpm portable -- run crates/matra-seed/examples/portable main.wasm
```

パッケージ管理、npm・Python連携、独立したruntimeの配布はこの実動版に含めません。
3 OS検証のCI定義はありますが、正式サポートの宣言ではありません。

## 文芸的プログラミング文書

`@matra/core/experimental/literate`はNode.js 22/24向けの実験的APIで、
文芸的プログラミング文書をbuild・実行します。信頼した文書コードを実行し、
OS sandboxやtimeoutは保証しません。compiler Wasmを同梱するため、導入後にRustは不要です。
標準JavaScript module・npm・Python連携は未実装です。
[Core APIと制限](packages/core/README.ja.md#実験的なnodejs向けliterate-api)と
[文芸的プログラミング仕様](spec/literate-modules.ja.md)を参照してください。

## パッケージ

- [`@matra/core`](packages/core)
- [`@matra/cli`](packages/cli)
- [`@matra/command`](packages/command)
- [`@matra/graphics`](packages/graphics)
- [`@matra/html`](packages/html)
- [`@matra/math`](packages/math)
- [`@matra/math-compute-engine`](packages/math-compute-engine)

各パッケージは、Coreが定義するツリー表現とparser / renderer境界を共有しながら、
HTML、Math、Graphics、実行環境統合などのdomain-specificな責務を分担します。

## XML-style markup

文書ノードは XML-style markup としても記述できます。属性は文字列、本文は text と子要素として
解釈し、空白を保持します。既存の `tag(attrs) { ... }` も引き続き使用できます。
`<>` は Matra node の境界を明示する補助記法で、`.class` shorthand も使用できます。

```matra
<article>
  <p.lead>Hello <strong>Matra</strong>!</p>
  <img src="image.png" />
</article>
```

XML 全体や HTML の省略・補正規則には対応しません。範囲と制約は
[文法仕様](spec/grammar.ja.md#xml-style-markup)を参照してください。

## Compiler bootstrap

Rust seed compilerとMatra製bootstrap compilerの開発状況は
[`crates/matra-seed`](crates/matra-seed/README.ja.md)を参照してください。

## Website

公式サイト・ドキュメント・Playgroundは
[`matralang/website`](https://github.com/matralang/website) で管理しています。

## Development

```sh
pnpm install
pnpm run build
pnpm test
pnpm run lint
```

英語文書は`name.md`、対応する日本語文書は`name.ja.md`とします。
JavaScript / TypeScriptなどのformatにはBiomeを使用します。`pnpm run format`でformatできます。
