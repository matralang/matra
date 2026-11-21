# Matra build tools 0.3.2

## 日本語

CLI `0.3.2`はnpmの安定版releaseです。中身は公開済み`0.3.2-alpha.3`と機能的に同一で、
Core `0.3.1`・HTML `0.3.1`・site-generation `0.1.0`・CLI `0.3.2`を安定版として公開します。
このZIP配布は引き続き未署名の実験的配布です。既存のZIPやタグは変更せず、
署名や専用インストーラーは今後の改善とします。

### 今回の変更

- Core・HTML・site-generation・CLIをprereleaseから安定versionへ更新しました。機能変更はありません。
- `site.components`で指定した`.matra`の関数をページ・layout間で再利用できます。
- `fn Card(props, children) { ... }`を定義し、`Card({ title: "見出し" }, [p { "本文" }])`で呼び出します。
- `generateSite()`でJavaScriptからroute・source・layout・dataを直接登録できます。
- ページデータのJSON化や中間Markdownなしで部品へデータを渡せます。既存のファイル方式も維持します。
- npmからは`npm install --global @matra/cli@0.3.2`で導入できます。

### Windowsの既知のダウンロード警告

以前の`0.3.1-alpha.1`で、WindowsのChrome標準保護に
「危険なダウンロードがブロックされました」と表示される報告があります。
原因は未特定で、誤検知とは確認できていません。報告対象のCPU構成も未特定です。
警告が出た場合は取得・実行を中止してください。保護機能の無効化や警告の無視は推奨しません。
checksum・CI成功は配布物の一致と動作の検証であり、マルウェア検査や安全性の保証ではありません。
ZIP内のREADMEにはこの報告がありません。取得前にこのreleaseページの最新案内を確認してください。

### 試し方

Node.js同梱のMatraビルドツールの配布です。OS・CPUに合うZIPと`.zip.sha256`を取得し、
checksumを確認して展開してください。展開したフォルダーをPATHへ追加すると、
システムのNode.js・pnpm・Rustなしで`matra init hello`、`matra build`、`matra dev`を使えます。
手順は同梱の`README.ja.md`、正確なversionとsource commitは`versions.json`を参照してください。

- 対象：macOS・Linux・Windows × x64 / arm64（6構成）
- Node.js：24.17.0固定。Core・HTMLのversion、compiler ABIは配布版とは別管理
- Linux：公式Node.js対応のglibc環境。Alpine / muslは対象外
- 署名・公証なし。macOSの実行承認が必要になる場合があります
- 文書内のJavaScriptを実行します。信頼する文書のみをbuildしてください。sandbox・timeout保証なし
- `dev`はlocalhostのみ。自動再buildに対応し、ブラウザ再読み込みは手動
- 外部packageは事前の`matra install`が必要です。buildは依存を自動installしません
- 宣言的な複数ページサイトは`matra site build`で利用可能。詳細は同梱READMEを参照
- ZIPのbyte再現性は保証しません。checksumは破損検出用で、電子署名ではありません
- Windows実機でのnpm registryからの導入と対話操作は未確認です

## English

CLI `0.3.2` is a stable npm release. It is functionally identical to the published
`0.3.2-alpha.3`, publishing Core `0.3.1`, HTML `0.3.1`, site-generation `0.1.0`, and
CLI `0.3.2` as stable versions. This ZIP distribution remains an unsigned experimental
channel. Existing ZIPs and tags are unchanged; signing and a dedicated installer are
future improvements.

### Changes in this release

- Core, HTML, site-generation, and CLI moved from prerelease to stable versions without functional changes.
- Reuse functions from `.matra` files registered through `site.components` across pages and layouts.
- Define `fn Card(props, children) { ... }` and call `Card({ title: "Heading" }, [p { "Body" }])`.
- `generateSite()` registers routes, sources, layouts, and data directly from JavaScript.
- Pass data into components without JSON serialization or intermediate Markdown; file-based builds remain supported.
- Install from npm with `npm install --global @matra/cli@0.3.2`.

### Known Windows download warning

For the earlier `0.3.1-alpha.1`, Chrome Standard protection on Windows has been reported
to show “Dangerous download blocked”.
The cause and affected CPU target are not yet identified; a false positive has not been established.
Stop downloading or running the files if a warning appears. Do not disable protection or ignore warnings.
Checksums and CI results verify consistency and behavior, not malware absence or safety.
The bundled README does not include this report; read the latest release page before downloading.

### Trying the tools

This distribution bundles Node.js with Matra build tools.
Download the ZIP for your OS/CPU and its `.zip.sha256`, verify the checksum, and extract.
Add the extracted folder to PATH to use `matra init hello`, `matra build`, and `matra dev`
without system Node.js, pnpm, or Rust. See the bundled `README.md` for instructions
and `versions.json` for exact versions and the source commit.

- Targets: macOS, Linux, Windows × x64/arm64 (six configurations)
- Pinned Node.js 24.17.0; Core/HTML package versions and compiler ABI are managed separately
- Linux requires official Node.js-compatible glibc; Alpine/musl is excluded
- Unsigned and not notarized; macOS may require approval to run downloaded software
- Builds execute document JavaScript; only build trusted documents. No sandbox/timeout guarantee
- Localhost-only dev server with automatic rebuild; browser refresh is manual
- External packages require `matra install`; builds do not install dependencies automatically
- Declarative multi-page sites are available with `matra site build`; see the bundled README
- ZIP byte reproducibility is not guaranteed; checksums detect corruption, not signed authenticity
- Registry installation and interactive operations on a physical Windows machine remain unverified

## 導入例 / Getting started

ZIPとchecksumを同じディレクトリへ保存し、対象に合わせてファイル名を変更してください。
Save the ZIP and checksum together and adjust filenames for your target.

```sh
# macOS arm64
shasum -a 256 -c matra-0.3.2-darwin-arm64.zip.sha256
# Linux x64
sha256sum -c matra-0.3.2-linux-x64.zip.sha256
```

Windows PowerShell（x64の例 / x64 example）：

```powershell
$zip = "matra-0.3.2-win32-x64.zip"
$expected = ((Get-Content "$zip.sha256" -Raw) -split '\s+')[0]
if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
    throw "Checksum mismatch"
}
```

不一致なら展開・実行しないでください。Do not extract or run mismatched files.
展開した実体のフォルダーをPATHへ追加します。Add the actual extracted folder to PATH.
起動コマンドだけを移動・symlinkしないでください。Do not relocate or symlink just the launcher.

```sh
# macOS arm64 example
export PATH="/absolute/path/to/matra-0.3.2-darwin-arm64:$PATH"
```

```powershell
# Windows x64 example
$env:Path = "C:\path\to\matra-0.3.2-win32-x64;$env:Path"
```

```sh
matra --version
matra init hello
cd hello
matra build
matra dev
```

`hello`は存在しないディレクトリを指定します。Use a destination that does not exist.
生成HTMLは`dist/index.html`です。Open `dist/index.html` or the URL printed by `matra dev`.
ブラウザ再読み込みは手動です。Refresh the browser manually.
不具合は[GitHub Issues](https://github.com/matralang/matra/issues)へOS・CPU、version、操作、エラーを報告してください。
Report OS/CPU, version, steps, and errors through Issues. Do not attach secrets or private documents.
秘密情報や非公開文書は添付しないでください。

## 検証記録 / Validation

- Draft作成は6対象のCI・checksum・出典検証を必要とします。公開前の実機確認・承認は別途必要です。
- Draft creation requires six-target CI, checksum, and provenance verification. Manual checks
  and separate approval are required before publication.
- 前の候補の検証記録・Windows Chromeの報告は
  [試験配布手順](https://github.com/matralang/matra/blob/develop/spec/build-tools-release.ja.md)を参照してください。
- See the [release procedure](https://github.com/matralang/matra/blob/develop/spec/build-tools-release.md) for the previous candidate's
  validation and the Windows Chrome report.
