# Markdownによる多言語の文芸的プログラミング（設計案）

[English](./literate-modules.md) | [日本語](./literate-modules.ja.md) | [索引](./README.ja.md)

## 状態と対象

本書は初版の実装契約と将来の設計案を区別して記述する。正式な文法仕様ではない。
実装範囲は次節の明示入口、`.js.part`、Markdown内`.js` moduleの相対importと事前install済みnpm依存、
およびPyodideで実行する`.py` moduleである。
[共通ランタイムのロードマップ](./portable-runtime.ja.md)を補足する。

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
入口は単一の`.matra`仮想ファイル、値は`.js.part`、`.js`または`.py`のlistとする。
`.js`は標準JavaScript ESMとして扱い、named exportまたはdefault-only exportを公開できる。
`.py`はPython moduleとして扱い、`__all__`で列挙したexportを公開する。
`matra.values`で選んだmoduleのみMatraへ公開し、相対importで到達するfenceはdependencyとして含めるが、
別途選択されない限りMatra名へ公開しない。
`matra.values`を省略した場合は空listとし、指定しないblockは初期化・実行しない。
build APIとCLIは実行環境上の文書名・pathだけを受け取り、entry/value設定は文書から読む。
FrontMatterのない文書、無効なYAML、欠落または不正な設定はdiagnosticにする。
暗黙のimportや実ファイル検索はない。
`ROOT`と実ファイルのパスは[共通ランタイムの論理パス契約](./portable-runtime.ja.md)に従う。
出力はversion付きJSON bundle（Wasm、選択blockと必要なmodule dependencyのsource・元位置）とし、
`run`は文書data modelの
JSONをstdoutへ1行で出力する。関数などJSONで表せない文書結果はエラーとする。
[実行可能なサンプル](../crates/matra-seed/examples/literate-values.md)は合計`60`を含む文書を生成する。
回帰testは`node --test crates/matra-seed/tests/literate-runtime.test.mjs`で実行する。

### 仮想ファイルと形式

- FrontMatterは文書の先頭に置き、`matra` mappingの`entry`と`values`を設定する。
  `entry`は必須の文字列、`values`は省略可能な文字列listである。
  他のFrontMatter項目はこのruntimeでは使用しない。YAMLとしてparseし、不正な形式や型を拒否する。
  FrontMatter内の文字列に含まれるfenceは登録せず、閉じdelimiterの後の本文だけを走査する。
- fenceは行頭から0〜3個のspace、3個以上のbacktickまたはtildeで開く。
  閉じdelimiterは同種で開き以上の長さとし、後ろはspace/tabのみとする。
  CRLFはLFへ正規化する。本文の行番号を保持し、閉じ忘れを拒否する。
  外側fence内の説明例を仮想ファイルとして再走査しない。
- info全体を前後trimした単一のファイル名として扱う。拡張子のない言語名fenceは説明用とする。
  ファイル名は`/`区切り、各componentはASCIIのidentifierまたはそれにdot接尾辞を付けた形とし、
  `.`・`..`、空component、絶対パス、backslash、queryを拒否する。
  パスは大小文字を区別するが、大小文字だけ異なる重複も拒否する。
- 全名前付きfenceの重複パスを登録時に拒否する。`.js`、`.js.part`、`.py`は別形式とする。
  `.js.part`の公開名は接尾辞を除いたpath、`.js`のnamed exportはmodule pathにexport名を追加したpath、
  default-only exportは接尾辞を除いたmodule pathとする。同じmoduleでdefaultとnamed exportを併用しない。
  `.py`の`__all__`に列挙したexportはmodule pathにexport名を追加したpathとする。
  実際に公開される同名・親子名は衝突エラーとする。
- 選択した入口は`.matra`、値は`.js.part`、`.js`または`.py`のみ受理する。
  その他の形式と`?values`引数ヘッダーは未対応として診断する。本文から形式を推測しない。
- `.js` fenceは同じ文書内の`.js` fenceへの相対static ESM import/re-exportを使える。
  import pathは`./`または`../`で始まり、`.js`で終わり、登録済みfenceへ解決しなければならない。
  bare package specifierは、実行環境に事前installされたnpm packageのimport/re-exportに使える。
  `node_modules`の自動生成・変更はしない。fenceからの直接Node builtin import、package import map、dynamic `import()`、
  import attributes、top-level await、循環依存は拒否する。
  import対象は`matra.values`へ重ねて列挙しなくてよい。
  Matraのbindingと同名の公開rootは既存のduplicate-binding診断で拒否する。
- `.py` fenceは同一文書内の他の`.py` fenceとPython標準ライブラリをimportできる。
  文書内moduleはPythonのimport名（pathの`/`を`.`へ変換）で解決し、build時に依存をbundleへ含める。
  外部packageは`matra.python.packages`にpackage名だけを記述する。versionはinstall時に自動解決し、
  文書ごとの`.matra/deps/<document-key>/python/matra.python.lock.json`へ対応entryを記録する。
  `<document-key>`はproject相対文書pathのbackslashを`/`へ正規化した文字列のlowercase SHA-256である。
  lock formatは`matra-python-wheels-1`で、
  同梱Pyodideの厳密なversionに固定する。entryにはcanonical package名、version、Python store相対wheel path、
  SHA-256を記録する。`py3-none-any` wheelだけを受理し、内容はpurelib fileに限定する。
  wheelが宣言する依存packageもすべてlockに含める。buildはpackage codeを実行せずhashとmetadataを検証する。
  bundleにはwheel bytesではなくpathとhashを記録し、run時にhashを再検証してfresh runtimeへinstallする。
  実行時network access、PyPI解決、`micropip`は使わない。
  例えばfront matterは`javascript: { packages: ["lodash-es"] }`と`python: { packages: ["idna"] }`とする。
  lock fileの形式例:

  ```json
  {
    "format": "matra-python-wheels-1",
    "pyodide": "314.0.7",
    "packages": [{
      "name": "idna",
      "version": "3.10",
      "file": "wheels/idna-3.10-py3-none-any.whl",
      "sha256": "<64 lowercase hex characters>"
    }]
  }
  ```

  選択した各moduleは`__all__`を文字列のliteral list/tupleとして宣言し、各exportをmoduleの公開名に対応させる。
  `__all__`未指定や不正なexport、循環依存はdiagnosticにする。動的importは未対応とする。
- `.py`の公開値は共通data valueまたは同期関数に限る。Python整数は安全なbinary64整数範囲に制限し、
  `None`、boolean、有限float、文字列、密なlist、文字列keyのdictを境界ごとにcopyする。
  class instance、tuple、set、bytes、循環、awaitable、async functionは拒否する。
- `.js.part`はstrict modeで本文全体を括弧で囲んだ単一のJavaScript式として構文検証する。
  object式、関数式、arrow、改行とJavaScript commentを受理する。
  import/export宣言、複数文、末尾semicolonを拒否する。別形式へのfallbackはない。

### 登録・build・実行

登録は名前・衝突・選択対象を検証し、buildは選択した`.js.part`式と`.js` module/dependencyの構文・
import解決、`.py` moduleのPython構文・import依存を検証してMatraをWasmへcompileする。
Python syntax解析にはPyodideを使うが、build時に文書のPython codeを実行しない。
実行時は選択した`.js.part`をASCII path昇順で初期化し、選択したESM moduleをNode.js標準loaderで初期化してから入口を実行する。
ESMの依存初期化順は標準loaderに従い、各moduleは一回のrunで一度だけ初期化する。関数本体は呼び出し時だけ実行する。
bare packageの解決起点は`moduleRoot`（省略時は`process.cwd()`）にある
`.matra/deps/<document-key>/javascript/node_modules`とする。
CLIは指定された`ROOT`を渡す。依存packageとその推移依存はNode.js標準loaderで解決し、build時にinstall・実行しない。
選択されたPython moduleはrunごとに初期化したPyodide runtimeで実行する。
Pyodide runtimeとPython標準ライブラリはnpm配布物へ同梱し、実行時のPython downloadはしない。
build時のwheel参照解決には文書別store内のwheelを使い、
`runLiterate`にも同じ`moduleRoot`を渡す。CLIは`ROOT`を両方に使う。Python packageの実行時network accessはない。
Python moduleのimportとtop-level codeはrun時に評価し、関数本体は呼び出し時に実行する。
PythonとJavaScriptのmodule状態はrun間で共有しない。Python側からNode.js等のhost機能へアクセス可能なため、
Pyodideもsandboxではなく、信頼した文書だけを実行する。
再実行では新しいJavaScript contextと値を作り、同一実行内のclosure状態だけを保持する。
`.js.part`は従来どおり新規VM contextで評価し、公開名・Matra bindingを注入しない。
標準`.js` moduleはNode.js process内で実行され、hostのglobalや権限から隔離されない。
static importの制限はsandboxではなく、module codeが`process`等へアクセスすることを防がない。
module側のtop-level副作用は各runで再実行され、process-globalな変更はrunを越えて残り得る。
信頼した文書だけを実行する。OS sandboxやtimeout保証はない。
初版はWasm実行のみを提供し、別のインタプリタ方式は追加しない。
将来の方式もこの初期化・呼び出し契約を共有し、build時評価を導入しない。

### 依存の準備

依存はFront Matterの`matra.javascript.packages`と`matra.python.packages`にpackage名だけを宣言する。
`matra install [DOCUMENT] [--yes]`はnpmとPythonをまとめて準備する。
`matra deps install [DOCUMENT] [--yes]`も同義で、文書の省略時はproject rootの`index.md`を使う。
project設定fileの追加や他文書の自動探索は行わない。依存がないecosystemはtoolの起動も省略し、
両方とも依存がない場合はnetwork確認なしで終了する。
両方の宣言と実行計画を準備してから一度だけ確認し、npm、Pythonの順で実行する。
npmが失敗した場合はPythonを実行しない。Pythonが失敗した場合はエラー終了するが、
完了したnpm installをrollbackしない。既存のlock維持・文書別storeは個別installと共通である。
`matra deps install npm DOCUMENT`と`matra deps install python DOCUMENT`でecosystemごとに準備し、
初回installは最新の互換versionを自動解決する。npmは文書ごとの内部`package.json`と
`package-lock.json`を管理する。PythonではhostのPython 3/pipで同梱PyodideのPython version向けwheelを取得し、
binaryの`py3-none-any`だけに限定する。Python executableは`MATRA_PYTHON`で指定でき、省略時は
macOS/Linuxで`python3`、Windowsで`python`を使う。

生成物は文書key別の`.matra/deps/<document-key>/`へまとめる。npmは`javascript/`にmanifest、lock、
`node_modules/`、Pythonは`python/`にwheel lockと`wheels/`を置く。通常installは既存lockに制約され、
`matra deps update npm DOCUMENT`または`matra deps update python DOCUMENT`だけがversionを再解決する。
wheel metadataとSHA-256を記録し、wheel codeは実行しない。Matra Commandの明示的なexecution planを使い、
network accessを要求して実行前に確認する。非対話実行では`--yes`で確認できる。
npm lifecycle scriptは無効にする。

`<document-key>`はproject相対文書pathのbackslashを`/`へ正規化した文字列のlowercase SHA-256である。

`matra.javascript.packages`はunscopedまたはscoped npm package名を受け付ける。
`matra.python.packages`はPEP 503で正規化されるpackage名を受け付ける。version、range、URLは記述しない。

`matra build`と`runLiterate`は依存のinstall・解決を行わない。事前に明示操作で準備する。
library APIではbuild/run両方に同じproject rootを`moduleRoot`として渡す。

### 値境界とdiagnostic

`.js.part`、`.js`、`.py`の値境界では`null`、boolean、有限数、文字列、密な配列、plain objectのown enumerableな
文字列key/data propertyを再帰copyする。JavaScript/PythonからMatraへは同期関数値も公開できる。
Matraから渡す引数はcopyし、host側の変更をMatraへ反映しない。戻り値もcopyする。
共有参照は保存せず、循環、accessor、symbol key、非enumerable property、疎配列、
独自prototype、`undefined`、BigInt、非有限数、Promise/thenableを拒否する。
Python整数は`-(2^53-1)`から`2^53-1`の範囲に限り、Python関数が返すtuple、set、bytes、class instance、
async function/awaitableも拒否する。
文書nodeは現状plain dataとして渡せるが、Matra nodeを第一級値とする専用変換はない。
standard moduleのtop-level exportは関数または共通data valueとし、関数を含むobject exportは拒否する。
Matra関数のJavaScript/Pythonへの引き渡し、非同期処理は未対応とする。
JavaScript関数の`this`は`undefined`とし、非関数の呼び出しは既存hostの明示的エラーとする。
文書出力は上記data subsetのみを受理し、関数値は拒否する。

loaderは`LiterateError.code`と元文書・仮想パス・本文開始行を報告し、
JavaScript例外はcause/stackに元の行・列を保持する。Matraのcompile診断は元文書行へ対応させる。
Matra実行時エラーは入口ブロック位置を報告する（式単位のsource mapは後続段階）。
重複、未対応形式、欠落、構文・初期化・呼び出し・値境界の失敗を成功扱いにしない。
後続の設計例と初版の制約が異なる場合、この節を初版の正本とする。

## v0.3の公開API・配布契約

この節はv0.3の契約を定める。サブパスと配布実装はrepositoryにあり、npm公開済みという意味ではない。
v0.3では新しいnpm packageを増やさず、`@matra/core/experimental/literate`サブパスからNode.js向けの
`buildLiterate`、`runLiterate`、`LiterateError`と対応する型定義を実験的に提供する。
文書化・テストされた公開APIだが、安定APIとしての互換性は保証せず、変更・移動時には移行手順を示す。
公開前の旧パス`@matra/core/literate`はexportせず、互換aliasも提供しない。
実験的という位置付けはliterate APIと配布方式に限り、通常のCore APIの位置付けは変更しない。
Node.js固有の実行機構とcompiler供給の実装は通常のCore入口から分離し、
将来の独立package化を予定する。独立packageの名称と分離時期は未定であり、分離時には移行手順を示す。
通常の`@matra/core`のimportはliterate hostやcompiler Wasmを読み込まず、
Node.js固有moduleへの新しい依存を持たせない。HTML rendererにも実行機能を含めない。
CLIは`matra-literate build ROOT DOCUMENT.md OUTPUT.json`と`matra-literate run ROOT OUTPUT.json`を提供する。
Markdown内の標準JavaScript ESM fence、同文書内の相対import、事前install済みnpm packageのbare import、
およびPyodideによる`.py` moduleを実験的にサポートする。Pythonは標準ライブラリに限定する。
ブラウザ実行、npm packageの自動install、Python packageのnetwork解決はこの公開APIの範囲外とする。

### 関数と値の契約

| API | 入力 | 成功時の結果 | 実行しないこと |
| --- | --- | --- | --- |
| `buildLiterate(markdown, options?)` | Markdown文字列、省略可能な`options.document`と`moduleRoot` | 実行用bundleを返すPromise | 文書中のJavaScript/Python codeとMatra programの実行、networkでのpackage解決、HTML生成 |
| `runLiterate(bundle, options?)` | 対応する形式・ABIのbundle、省略可能な`globals`と`moduleRoot` | 文書data subsetの値を返すPromise | 再コンパイル、network access、HTML生成、ファイルへの出力 |

`options.document`は診断用の名前で、省略時は`<markdown>`とする。ファイルを自動で読み込む指定ではない。
entryとvaluesはFrontMatterを正本とし、呼び出し側からの上書きは拒否する。
対応するcompiler Wasmを同梱するため、通常の利用でcompilerのpath指定や取得設定は要求しない。
`moduleRoot`はnpm依存とPython wheel参照を解決するproject directoryであり、省略時は`process.cwd()`を使う。
npm packageは事前にinstallし、Python wheelも事前に配置する。build/runはproject依存をdownload・変更しない。
Python wheelはfreshなPyodide runtime内だけへinstallし、bundleはwheel pathとhashを保持してbytesを同梱しない。

buildの戻り値はJSONとして保存・復元できるversion付きbundleとする。Wasmに加えて選択した
JavaScriptソースと元位置を含み、ソース秘匿や任意version間の互換性は保証しない。
対応するbundle形式とcompiler/host ABIを明記し、非対応の組み合わせは実行前に拒否する。
現在の形式は`matra-literate-1`、ABIは`matra-value-1`とし、bundleの`format`と`abi`に記録する。
ABIのない旧内部bundleは再buildする。公開型は`LiterateBuildOptions`、`LiterateBlock`、`LiterateBundle`である。
同じbundleの複数回実行は可能だが、JavaScript contextと値は毎回新規に作る。
contextの分離は、任意のユーザーコードの結果が常に同じになることを保証しない。

runの結果はAST専用型ではなく、既存の値境界を満たす値とする。
rendererへ渡す文書nodeは、必要に応じてCoreの`staticValueToAST()`でASTへ変換する。
通常の作例ではbundleをメモリ内で渡し、中間ファイル、JSONへの変換と読み戻し、
子プロセスを必須にしない。

```js
import { staticValueToAST } from "@matra/core"
import { buildLiterate, runLiterate } from "@matra/core/experimental/literate"
import { toHTML } from "@matra/html"

const bundle = await buildLiterate(markdown, { document: "web-page.md" })
const value = await runLiterate(bundle)
const ast = staticValueToAST(value)
const html = toHTML(ast)
```

上記のサブパスはrepositoryに実装されている。pack検証ではcheckout外から同じimportを使用する。
別project向けの導入手順では、内部ファイルの相対importを使用しない。
CLIは同じbuild/run実装を利用する薄い入口とし、別の評価規則を持たせない。

### compilerの取得・再生成とprovenance

利用者は公開された正確なversionの`@matra/core` packageを取得する。
compiler Wasmとmanifestはpackageの`dist/literate/`に含まれ、別downloadはしない。
release記録にはGit tagとcommit SHA、package version、同梱manifest、
npm registryのtarball integrityを残す。

compilerをcheckoutから再生成する場合は、release tagのclean checkoutとlockfileを使う。
Rust toolchainは[`rust-toolchain.toml`](../rust-toolchain.toml)で固定する。

```text
pnpm install --frozen-lockfile
rustup toolchain install 1.97.1 --profile minimal
pnpm --filter @matra/core run build
pnpm test:literate:package
```

Wasmのcompiler sourceは[`compiler.md`](../crates/matra-seed/examples/compiler.md)の
`compiler.matra` fenceである。[`build-compiler.mjs`](../packages/core/scripts/build-compiler.mjs)は
Rust seed compilerでStage 2/3を生成してbyte equalityを確認し、`dist/literate/compiler.wasm`
と`compiler.json`を生成する。manifestの`sourceSha256`はfenceから抽出したUTF-8 source、
`sha256`はWasm bytesのSHA-256である。`version`、ABI、byte size、Stage equalityも記録する。
実行hostとCLIのsourceはrelease commitの[`packages/core/src/literate/`](../packages/core/src/literate/)
で固定し、`compiler.mjs`は起動時にWasmのchecksum・ABI・exportを検証する。

`pnpm test:literate:package`はpack内容をcheckout外のtemporary projectへ導入し、
Rust・bootstrap cache・compiler downloadなしの実行と、Wasm欠落・破損・ABI不一致の拒否を検証する。
Wasmは生成物なのでGitへ追加しない。manifestとGit commitをpackage versionおよびnpm tarball integrityに
対応づけて記録することで、取得物・source・host・checksumの対応を追跡可能にする。

### 失敗・依存関係・公開条件

- 設定・compile・実行・値境界の失敗はPromiseのrejectとして伝える。
  `LiterateError.code`、文書・仮想パス・位置、利用可能なcauseを保持し、
  compilerの取得・読込・ABI不一致の失敗も識別できるようにする。
  エラーは`document`・`path`・`line`を持つ。同梱compilerの読込・checksum・ABI失敗は
  `COMPILER_LOAD`とcauseで、非対応bundleは`INVALID_BUNDLE`で報告する。
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
       └─ Python → Pyodide runtime
                    ↕
             共通の呼び出し契約
```

共通ランタイムは起動、依存関係、公開関数の接続、エラーの伝播を担当する。
全言語をWasmへcompileすることは必須ではない。
最初はNode.jsホストと既存の
[暫定host value ABI](../crates/matra-seed/host/value-host.mjs)を足場にできるが、
既存ABIをそのまま安定した共通プロトコルとして保証しない。
WASIやComponent Modelの採否も別途判断する。

JavaScript blockは事前install済みnpm packageを標準importで使える。Python blockはPyodide標準ライブラリと
hash lock済みの`py3-none-any` wheelを使える。PyPIの解決、native Python wheel、任意のnpm packageやnative addonの互換性、
3 OSでの同一動作、Webでの動作は保証しない。

引数・戻り値について、数値、文字列、配列、オブジェクト、文書ノード、数式、
巨大整数、バイナリ、関数参照の対応範囲とcopy/共有の意味を定義する。
例外、非同期処理、timeout・cancel、モジュール初期化、循環依存も契約に含める。
現在の同期host callがJavaScriptのPromiseを自動的に待つとは扱わない。

### 共通インターフェース初版案（意味契約）

これはNode.js ESM初版を越えてJavaScript・Pythonを共通に扱う意味契約案である。
ここに記すMatraJSON wire encodingは未実装だが、Python moduleはPyodideを使いこの値境界の一部を実装する。
言語固有のmodule loaderと、言語間で共通にする値・呼び出しの意味を分ける。
以下ではtransportをNode.js host内の直接接続とし、Matraの実行には既存のWasm方式を使う。
JavaScript/Python自体をWasmへcompileすることは要求しない。別process、WASI、Component Modelは初版の対象外とする。

#### 公開名とmodule lifecycle

- Matraから参照できるmoduleとexportは明示する。loader固有のimport構文や全moduleの暗黙公開を
  Matra文法へ導入しない。module/exportからMatra名への対応と、名前衝突の拒否規則はhost profileで定める。
- module依存は明示された依存関係とする。選択した入口から到達できる依存だけを解決・初期化し、
 依存先を依存元より先に初期化する。依存関係の循環は初版ではエラーとする。
- 互いに依存しないmoduleの順序は、hostが再現可能な規則で決める。同一run内で各moduleを高々一度初期化する。
 失敗したrunの再試行、module cache、runをまたぐ副作用・状態の扱いはloader契約で別途明示する。
- build/name registrationはuser codeを実行しない。module初期化はrun時に行い、import/exportの解決・初期化失敗を
  成功扱いにしない。JavaScriptのESM loaderやPythonのimport systemを使う場合も、上記の公開範囲と失敗伝播を保つ。

#### 共通値と呼び出し

- 初版の共通data valueはnull、boolean、IEEE 754 binary64の有限数、Unicode文字列、
  密な配列、文字列keyのobjectとする。Python整数は`-(2^53-1)`から`2^53-1`までを受理し、
  範囲外は暗黙に丸めずconversion errorにする。JS/Python双方で有限binary64へ変換できない数も拒否する。
- 配列・objectは境界ごとに再帰copyする。hostとのidentity共有や変更の反映は保証しない。
  循環、疎配列、文字列以外のmap key、accessorや独自class instanceなど、共通形へ損失なく変換できない値は拒否する。
  alias参照は保持せず各出現を独立にcopyする。
- Matra nodeとJavaScript/Pythonのdata valueをJSONで交換するときは、Matra nodeを通常のMatraJSON tuple、
  foreign data valueを要素一つの配列`[value]`で表す。MatraJSON nodeは`[tag, props, children]`なので
  3要素、data value envelopeは必ず1要素となり、top-levelで区別できる。例:

  ```text
  ["foo", {"bar": "5"}, ["hoge", "piyo"]]
  ["5"]
  [5]
  [true]
  [null]
  [[8]]
  [{"a": 3}]
  [["foo", {"bar": "5"}, ["hoge", "piyo"]]]
  ```

  最後の例はMatraJSON nodeと同じ形のJavaScript配列を表し、1要素envelopeの中身は再帰的に
  MatraJSONとして解釈しない。この規則により、通常のJSON array/objectとMatra nodeをshape推測で混同しない。
  foreign data valueはJSON互換subset（null、boolean、有限number、string、array、string-key object）とし、
  循環、非有限数、重複object key、表現不能なhost値は拒否する。Matra node内部は既存MatraJSON規則に従う。
- JavaScript/Python側でMatra nodeを利用するときは、このMatraJSON tupleをJSON相当の値として受け取り、
  必要に応じてparseし、Matra nodeとして返すときは明示的なnode constructor/APIからtupleへ変換する。
  通常のJS/Python値を返す場合は、nodeと同じ形の配列であってもhost value envelopeを使う。
  したがってtagはMatra nodeのconstructorとして働き、JSON primitiveはMatra側の値へ直接対応する。
- このencodingは既存MatraJSON data modelそのものを変更せず、言語間APIの交換profileとして定義する。
  profile versionはAPI/bundle契約で識別し、個々のnodeやvalueへ重ねて埋め込まない。
- foreign functionはrun sessionに属するopaqueなcallableとしてexport単位で公開し、Matraから同期呼び出しできる。
  引数・戻り値は共通data valueに限る。foreign functionやMatra functionをdata object内に埋め込むこと、
  Matra functionをforeign callbackとして渡すことは初版ではサポートしない。
  callable自体はJSON化可能なdata valueではなく、session内だけで有効なopaque handleとcall操作で扱う。
- 非同期module初期化、Promise/await等の非同期call、timeout・cancelは初版共通契約に含めない。
  Promise、awaitableその他の非同期値がdata境界または同期callから返った場合は明示的なunsupported/conversion errorにする。
- hostのfilesystem、network、process等の権限はこの値・呼び出し契約から自動付与しない。
  実際の権限と安全性は各host/runtimeが別途説明する。Node.js内の接続もOS sandboxを保証しない。

#### Errorと互換性

失敗は少なくとも`MODULE_RESOLUTION`、`MODULE_INITIALIZATION`、`FOREIGN_CALL`、
`VALUE_CONVERSION`、`UNSUPPORTED_FEATURE`の段階を識別する。error recordはcodeとmessageを持ち、
取得可能ならmodule/export名とsource locationを含む。元言語のexception/causeはhost側で参照可能にし、
共通data valueとしてMatraへ暗黙に返さない。文字列messageやhost固有stackの形式は共通化しない。

これは初版の意味契約案であり、依存の記述形式、独立module間の決定的な順序規則、
run間のmodule cache/state、resource limit、JS/Pythonそれぞれのpackage解決は別途決める。
Matra nodeをMatra Programの第一級実行時値として扱う文法・runtime契約も別途必要であり、
このwire encodingだけではその機能を実装しない。既存の`.js.part`契約・`matra-value-1` ABI・
現行ABIと`.js.part`契約を変更せず、Node.js ESM連携は実験APIへの追加である。

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

## 初版実装の確認と後続検証

初版契約のNode.js向け実装は実験的に提供する。`.js.part`、標準ESMと同文書内相対import、
事前install済みnpm依存、標準ライブラリ限定のPyodide `.py` moduleを含む。
Python buildはASTとimport依存を解析するだけで文書コードを実行せず、runごとに新しいPyodide runtimeを使う。
これはNode.js以外のhost、一般的なsandbox、全npm/Python packageとの互換性を保証しない。

主な回帰検証は次のとおり。

- `pnpm --filter @matra/core run build`でcompiler Wasmを生成し、Stage 2/3のbyte equalityを確認する。
- `node --test packages/core/tests/literate.test.mjs`で`.js.part`、ESM/npm、Pythonの構文・import・値境界・実行を検証する。
- `node --test --test-concurrency=1 crates/matra-seed/tests/literate-runtime.test.mjs`でseed側の共有runtime回帰を検証する。
- `pnpm test:literate:package`でpack済みCoreのPyodide同梱とcheckout外の実行を検証する。

補完、型チェック、整形、デバッグと元文書の詳細なsource mappingは後続課題とする。
Matra nodeの専用wire conversion、非同期interop、PyPI解決、native Python wheel、browser実行も初版の範囲外である。
