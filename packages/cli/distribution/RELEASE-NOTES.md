# Matra build tools — experimental prerelease

## 日本語

興味のある開発者が試すための実験的配布です。安定版・正式サポートの宣言ではありません。
既存のZIPを変更せず公開し、署名や専用インストーラーは今後の改善とします。

### Windowsの既知のダウンロード警告

WindowsのChrome標準保護で「危険なダウンロードがブロックされました」と表示される報告があります。
原因は未特定で、誤検知とは確認できていません。報告対象のCPU構成も未特定です。
警告が出た場合は取得・実行を中止してください。保護機能の無効化や警告の無視は推奨しません。
checksum・CI成功は配布物の一致と動作の検証であり、マルウェア検査や安全性の保証ではありません。
ZIP内のREADMEはこの報告より前の版です。取得前にこのreleaseページの最新案内を確認してください。

### 試し方

Node.js同梱のMatraビルドツールの試験配布です。OS・CPUに合うZIPと`.zip.sha256`を取得し、
checksumを確認して展開してください。展開したフォルダーをPATHへ追加すると、
システムのNode.js・pnpm・Rustなしで`matra init hello`、`matra build`、`matra dev`を使えます。
手順は同梱の`README.ja.md`、正確なversionとsource commitは`versions.json`を参照してください。

- 対象：macOS・Linux・Windows × x64 / arm64（6構成）
- Node.js：24.17.0固定。Core・HTMLのversion、compiler ABIは配布版とは別管理
- Linux：公式Node.js対応のglibc環境。Alpine / muslは対象外
- 署名・公証なし。macOSの実行承認が必要になる場合があります
- 文書内のJavaScriptを実行します。信頼する文書のみをbuildしてください。sandbox・timeout保証なし
- `dev`はlocalhostのみ。自動再buildに対応し、ブラウザ再読み込みは手動
- 既存ディレクトリへの`init`、汎用site generator、npm・Pythonの直接importは対象外
- ZIPのbyte再現性は保証しません。checksumは破損検出用で、電子署名ではありません

## English

This is an experimental distribution for interested developers, not a stable release or
an official support guarantee. Existing ZIPs are published unchanged; signing and a dedicated
installer are future improvements.

### Known Windows download warning

Chrome Standard protection on Windows has been reported to show “Dangerous download blocked”.
The cause and affected CPU target are not yet identified; a false positive has not been established.
Stop downloading or running the files if a warning appears. Do not disable protection or ignore warnings.
Checksums and CI results verify consistency and behavior, not malware absence or safety.
The bundled README predates this report; read the latest release page before downloading.

### Trying the tools

This experimental prerelease bundles Node.js with Matra build tools.
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
- No init into existing directories, general site generator, or direct npm/Python imports
- ZIP byte reproducibility is not guaranteed; checksums detect corruption, not signed authenticity

## 導入例 / Getting started

ZIPとchecksumを同じディレクトリへ保存し、対象に合わせてファイル名を変更してください。
Save the ZIP and checksum together and adjust filenames for your target.

```sh
# macOS arm64
shasum -a 256 -c matra-0.3.1-alpha.1-darwin-arm64.zip.sha256
# Linux x64
sha256sum -c matra-0.3.1-alpha.1-linux-x64.zip.sha256
```

Windows PowerShell（x64の例 / x64 example）：

```powershell
$zip = "matra-0.3.1-alpha.1-win32-x64.zip"
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
export PATH="/absolute/path/to/matra-0.3.1-alpha.1-darwin-arm64:$PATH"
```

```powershell
# Windows x64 example
$env:Path = "C:\path\to\matra-0.3.1-alpha.1-win32-x64;$env:Path"
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

- Source: `164b168f8e0d38501db934ff7f79141c4c04cf3b`
- [Distribution CI](https://github.com/matralang/matra/actions/runs/41039927410):
  all six native targets and aggregate Linux checksum/provenance/compiler checks passed.
- All six ZIPs and six checksums downloaded from the Draft and verified locally.
- Downloaded macOS arm64 ZIP passed relocation, empty PATH, init/build/dev checks.
- 未確認 / Not verified: browser-download approval/Gatekeeper on macOS, interactive Windows
  init/build/dev and Ctrl+C, and the cause of the Chrome warning. Automated Windows tests passed,
  but the user's browser-download check does not establish interactive runtime verification.
- Public Pre-release, not latest/stable. No npm publication or website deployment is included.
- Actions artifacts expire after seven days; Release attachments are independent of that retention.
