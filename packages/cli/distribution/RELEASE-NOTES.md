# Matra build tools — experimental prerelease

## 日本語

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
