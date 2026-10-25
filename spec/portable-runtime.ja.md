# Matraの移植性方針と共通ランタイムのロードマップ

[English](./portable-runtime.md) | [日本語](./portable-runtime.ja.md)

## 位置づけ

本書は設計・実装の判断基準と、v0.3の小さな実動版の契約を記述する。正式サポートの宣言ではない。
共通ホストAPIは下記の最小subsetを実装し、広範なAPI、パッケージ形式、タスク定義の具体仕様は未決とする。
一般のMatra Programとcompiler sourceの文法、既存ABI、公開APIは変更しない。
構文と評価の正本は引き続き[統一文法](./unified-grammar.ja.md)とする。

## v0.3の小さな実動版

v0.3の到達点は、Node.js上のホストを使い、同じMatra／Wasmプロジェクトを
Windows・macOS・Linuxで変更せずにbuild・実行することである。
独立したruntimeの配布、パッケージ管理、汎用タスクengine、npm・Python連携は含めない。
以下はexperimentalな最小契約であり、全体の完成は後述のロードマップに残す。

### 実行手順

repository checkoutに、pnpm（rootの`packageManager`に従う）、Node.js 22または24、
Rust toolchain（`rust-toolchain.toml`に従う）を用意する。
この入口とtestはNode.js組み込みmoduleのみを使い、workspace全体のbuildは必要としない。
初回buildにはRust seedが必要で、以後は既存のbootstrap compiler cacheを利用する。
独立した実行ファイルとして配布する手順ではない。

Rustはrustupで導入する。repositoryの`rust-toolchain.toml`がRust 1.97.1を選択するため、
初回のRust commandではこのtoolchainのdownloadが発生することがある。
WindowsではVisual Studio Installerで「C++によるデスクトップ開発」を選択し、
MSVC C++ build toolsとWindows SDKを導入する。RustのMSVC toolchainがnative seedをbuildする際に
`link.exe`が必要となる。RustやVisual Studioの導入後は、VS Codeを再起動するか新しいterminalを開く。
`rustc`または`cargo`が`PATH`に無い場合、`build`は終了code 1で停止し、Rust toolchainの導入方法を表示する。

repository rootで次を実行し、Rust 1.97.1が選択されることとportable testの成功を確認する。

```text
rustc --version
cargo --version
pnpm test:portable
```

repository rootで、3 OSとも同じコマンドを使う。

```text
pnpm portable -- build crates/matra-seed/examples/portable main.matra main.wasm
pnpm portable -- run crates/matra-seed/examples/portable main.wasm
```

`build ROOT SOURCE OUTPUT`は、Matra製Stage 1 compilerでsourceをWasmへcompileする。
`run ROOT WASM [ARGS...]`は、そのWasmを共通ホストAPIに接続して実行する。
`ROOT`はCLIを起動したdirectory基準のnative path、`SOURCE`・`OUTPUT`・`WASM`はroot相対の論理パスとする。
プログラムのfile APIも同じrootを基準とし、processの作業directoryを変更しない。
`ARGS`はWasmの後の引数のみであり、Node.jsやscriptのpathを含まない。
CLIの失敗はstderrと非zero exit statusで通知する。

[サンプル](../crates/matra-seed/examples/portable/main.matra)は`input.txt`を読み、
Matraの式で`Matra v0.3:`と半角spaceを付け、`output.txt`へ書き、`Wrote output.txt`を表示する。
最初の引数で入力fileを変更できる。入力fixtureはGitでもLFを固定し、生成物はignoreする。

### 最小の共通API

文書profileのWasmに、次の`runtime` bindingを明示的に注入する。
既存のmember/callとhost value ABIを使い、文法やWasm importを追加しない。
通常の`instantiateUnified()`には自動注入せず、既存の文書実行の動作を維持する。

| API | v0.3の契約 |
| --- | --- |
| `runtime.version` | このAPI subsetを識別する文字列`"0.3"` |
| `runtime.args` | 呼び出し側からcopyした文字列配列。`for`で走査できる |
| `runtime.read_text(path)` | regular fileをUTF-8で読み、文字列を返す。不正UTF-8を拒否する |
| `runtime.write_text(path, text)` | UTF-8でfileを作成または上書きし、`null`を返す |
| `runtime.print(text)` | 標準出力にtextとLFを1つ書き、`null`を返す |

I/Oは同期処理とする。textは改行を変換せず、UTF-8 BOMも文字として保持する。
文字列以外のpath/text、孤立surrogateを拒否し、暗黙の文字列化や置換文字への変換を行わない。
writeは親directoryを作らず、atomic writeや失敗時のrollbackは保証しない。
標準出力の書き込み失敗も実行失敗として扱う。

### 最小のパス契約とerror

- パスは空でないroot相対の`/`区切りとし、各componentはUnicode NFCで指定する。
  native filesystem上のNFD名はNFCで照合する。
- 絶対パス、drive指定、backslash、空component、`.`・`..`、
  control character、`<>:"|?*`、末尾のdot/space、Windowsの予約device名を拒否する。
- 既存名はNFCとUnicode lowercaseによって照合し、大小文字の不一致や同じ照合名の衝突を拒否する。
  OS固有の特殊なUnicode別名規則の完全な模倣は対象外とする。
- rootは既存directoryとする。root内のsymlink（Windows junctionを含む）、
  regular file以外の読み書き、存在しない親directoryへのwriteは拒否する。
  native root自体はcanonical pathへ解決する。

Node.js実装は`PortableRuntimeError.code`で`INVALID_ARGUMENT`、`INVALID_PATH`、
`CASE_MISMATCH`、`SYMLINK`、`NOT_FOUND`、`NOT_DIRECTORY`、`NOT_FILE`、
`IS_DIRECTORY`、`ACCESS_DENIED`、`INVALID_UTF8`、`IO_ERROR`を通知する。
host外のcompiler diagnosticやWasmの検証・実行errorもCLIで明示する。
検査は移植性のためのものであり、競合するfilesystem変更やhard linkなどを防ぐ
OS security sandboxではない。信頼して選んだプログラムとprojectで使用する。
network、時刻、環境変数、外部CLIを提供するAPIは、このsubsetに含めない。

### 検証と完了条件

```text
pnpm test:portable
pnpm bootstrap:verify
```

`test:portable`はhost APIとerrorの回帰test、および同じサンプルのCLI build/runを実行する。
`bootstrap:verify`はStage 2/3のbyte equalityに加え、各Stageのcompilerが生成した
サンプルWasmの読み込み・Matra処理・file書き込み・引数・標準出力を検証する。
[CI](../.github/workflows/portable-runtime.yml)はWindows・macOS・LinuxとNode.js 22/24のmatrixで
この2 commandを実行する。hostのセットアップ以外は共通である。
CI定義の追加だけでは3 OSで検証済みとは扱わず、対象commitの全job成功をv0.3の完了条件とする。
このCI対象は検証環境であり、OSの最低versionを含む正式サポート表ではない。

## 中心目標と保証範囲

最初の正式サポートで目指す保証は、次のとおりとする。

> Matraの共通APIと対応パッケージで作ったプロジェクトは、対応するWindows・macOS・Linuxで、
> ソースや設定を書き換えずに、依存解決・起動・ビルド・実行ができる。

Node.jsやPythonに近い使い勝手を目指すが、任意の外部CLI実行より、依存関係を含む移植性を優先する。
「同じプロジェクト」には、ソース、依存定義、ロックファイル、起動・ビルド定義を含む。
OSごとのMatra配布物のインストールや、明示的に宣言した認証情報などの実行環境の準備は別途必要となる。

| 層 | 方針 |
| --- | --- |
| 言語・標準ライブラリ | 共通仕様の範囲で3 OSに同じ意味と動作を提供する |
| パッケージ | 共通の実行仕様を満たし、依存先も対応するものを利用する |
| プロジェクト管理 | 同じ依存定義・ロックファイルから環境を再現する |
| 起動・ビルド処理 | OS固有のシェルコマンドを記述せずに定義する |
| 外部CLI・OS固有機能 | 明示的な拡張として分離し、共通の保証には含めない |
| Android・iOS | 当面はWeb動作または一部機能のみとし、PCと同等の保証はしない |

正式サポート前に、OSの最低バージョン、CPU architecture、実行エンジンとそのバージョン、
配布・インストール方法をサポート表で限定する。OS名だけで全環境への対応を約束しない。
Web環境の対応機能も別に示し、利用できない機能は実行前の検査または明確なerrorで通知する。

移植性は、時刻・乱数・外部通信の結果や、すべてのビルド成果物のbyte一致まで保証するものではない。
共通APIの意味、再現可能な依存解決、決定的なサンプルの結果を検証対象とし、
ビルドの再現性は入力・toolchain・環境の条件とともに別途定義する。

## 現在の資産と役割

- [Rust seedとMatra製compiler](../crates/matra-seed/README.ja.md)には、Wasm生成と
  Stage 1/2/3の自己ホスト検証がある。Stage 2/3のbyte一致はcompilerの検証であり、
  3 OSでのプロジェクト移植性を証明するものではない。
- [統一文法のWasm host](../crates/matra-seed/host/unified-host.mjs)は暫定のhost value ABIを提供する。
  [Node.js版の最小host](../crates/matra-seed/host/node-runtime.mjs)はその上にv0.3のfile I/Oなどを提供する。
  これは広範な共通ランタイムの完成を意味しない。
- [Matra Command](../packages/command/README.ja.md)は、実行計画と明示的な権限承認を持つ
  外部プロセス連携の資産である。`shell: false`でも外部プログラムの存在や移植性は保証されない。
  既存の実行機能を削除せず、環境固有処理へ接続する拡張として位置づける。
  capability宣言だけで子プロセスをOS sandboxに隔離できるわけではない。
- [`loadMatra`](../packages/core/src/jsonmatra.ts)はNode.jsのfile APIとmodule読み込みを利用する
  文書ローダーである。共通パッケージの読み込み・依存解決とは役割を分ける。
- [bootstrap artifact workflow](../.github/workflows/bootstrap-artifact.yml)はUbuntuで実行する。
  v0.3の3 OS検証は別のportable runtime workflowで行う。
  依存解決を含む全体の共通検証は、今後整える対象である。

Wasmを有力な共通実行形式とし、その外側を共通ホストAPIで揃える。
開発に用いるpnpm workspaceの管理と、将来のMatraユーザープロジェクトのパッケージ管理は区別する。
Wasmだけで任意のパッケージやOS機能が共通化されるとは扱わない。

## 優先して整える4つの契約

### 1. 共通ランタイムとホストAPI

各OSのホストが提供する機能・動作・errorを共通仕様にする。API名やABIは実装前に決める。
少なくとも次の差異を扱い、OSの既定値へ無条件に委ねない。

| 領域 | 仕様で決めること |
| --- | --- |
| ファイル・パス | 論理パスとnative pathの境界、基準directory、区切り、絶対パス、親directory参照 |
| ファイル名 | 大小文字、Unicode正規化、予約名・禁止文字、衝突と非移植名の検出 |
| 読み書き | textの文字コードと改行、binaryとの区別、directory列挙順、symlink、権限、error分類 |
| 通信 | 対応protocol、非同期処理、timeout・cancel、権限、Webでの制約 |
| 時刻 | 壁時計と単調時計、単位・精度、timezone、localeに依存しない処理 |
| 環境変数 | 明示的な受け渡し、未定義値、名前の大小文字、機密値の扱い |
| 実行境界 | host APIのversion、値とmemoryの受け渡し、resource limit、非対応機能の通知 |

全OSのfilesystemを完全に模倣することは前提としない。移植可能な範囲と範囲外の入力に対する
diagnosticを定め、成功してから別OSで意味が変わる状態を避ける。

### 2. パッケージの互換性と依存解決

Matraパッケージと、対応するWasmパッケージを基本にする。
Wasmであっても、importするhost機能・ABI・実行モデルが合うことを確認する。
依存先を含め、必要なruntime/API version、機能、権限を確認できるようにする。

同じ依存定義・ロックファイルでversionと内容を固定し、取得物のintegrityを検証する。
未対応の依存先、lockの不整合、破損した取得物を明確に報告し、別versionへの暗黙のfallbackは行わない。
OS固有のinstall scriptやローカルCLIを隠れた前提にしない。
registry、manifest、lock形式、cache、更新・offline動作の詳細は未決とする。

npm・Python資産は、連携ごとに対応条件を確認する。
既存の`@matra/*` npmパッケージも、それだけで共通ランタイム対応になるわけではない。
任意のnpm/Pythonパッケージ、native addon、外部runtimeとの互換性は約束しない。

### 3. OSに依存しないタスク定義

起動・ビルドを、共通機能と明示的な依存関係で記述できるようにする。
ファイルコピー、directory作成・削除、対応compilerの呼び出しなどに、
`cp`・`rm`・PowerShellやshellの文字列展開を必要としない設計とする。

タスクの作業directory、入出力、実行順、失敗の伝播、権限を定義する。
外部CLIが必要なタスクは拡張として明示し、その前提条件と共通保証の範囲外であることを示す。
タスクの構文・ファイル形式、Matra Commandの計画モデルを再利用する範囲は未決とする。

### 4. 3 OSでの継続検証

同じサンプルプロジェクトとロックファイルをWindows・macOS・LinuxのCIで使う。
ユーザープロジェクトのソースや設定をOSごとに書き換えず、cleanな環境で
依存解決・起動・ビルド・実行の一連の流れを検証する。
CIのhostセットアップの差と、ユーザープロジェクト側の差は区別する。

成功例に加え、大小文字・Unicode・改行・空白を含むパス、非移植名、権限不足、
非対応の依存先、integrity違反、タスク失敗を回帰testにする。
決定的なサンプルは出力とerror分類を比較し、compilerを変更する場合は
既存のStage 2/3 byte equality検証も維持する。

## 段階的なロードマップ

| 段階 | 成果と完了条件 |
| --- | --- |
| 1. 保証範囲の具体化 | サポート表、最小host API、互換性・権限・error契約と受理/拒否例を日英で定義する |
| 2. 最小の縦断実装 | ローカルの対応パッケージを読み込み、共通APIでサンプルを起動・ビルド・実行する |
| 3. 依存環境の再現 | transitive dependency、lock、integrity、cacheを実装し、同じ依存集合を復元する |
| 4. PC正式サポート | 3 OSのclean CIで全工程と失敗例を継続検証し、配布物とサポート表を公開する |
| 5. 対応範囲の拡張 | Web・スマホの機能表と、条件付きnpm/Python連携・外部CLI拡張を個別に検証する |

3 OSでの検証は最終段階まで延期せず、段階2から段階的に導入する。
正式サポートは段階4の条件を満たしてから宣言する。

## v0.3以降の設計で決めること

v0.3のNode.jsホストと単一sourceの実行を足場に、正式なPCホストの配布方式とサポート表、
file/path APIの拡張、ローカルパッケージの読み込み単位、汎用タスク定義を決める。
WASIやComponent Modelの採否、Node.jsなど既存hostの利用範囲も、この契約に照らして比較する。
Wasm形式だけを先に固定して、必要なhost機能や配布条件を後回しにしない。

runtimeの配布では、まず利用者の導入の簡単さを優先し、次に導入時間・download sizeと
配布・保守の負担を抑える。実現可能な場合は、対応runtimeを自動取得・設定する方式を優先候補とし、
offline環境やnetwork制限向けに必要runtimeを同梱する配布物も検討する。
正式サポート前に、対応version、更新方法、OS別のpackage形式、必要なlicense・第三者表示を決める。
これは将来の方針であり、現在その方法でruntimeを導入・配布していることを示すものではない。
