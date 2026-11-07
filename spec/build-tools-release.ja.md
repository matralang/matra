# ビルドツールの試験配布手順

[English](./build-tools-release.md) | [日本語](./build-tools-release.ja.md)

## バージョンと公開の境界

初回の候補は`0.3.1-alpha.1`です。[CLI package](../packages/cli/package.json)のversionを
配布フォルダー・ZIP・`matra --version`の正本にします。
Core・HTMLの`0.3.0`やcompiler ABIは変更しません。
`versions.json`に個別のpackage version、compiler manifest、Node.js versionとchecksum、
source commit、dirty状態、lockfile checksumを記録します。

タグ名は`build-tools-v0.3.1-alpha.1`です。言語releaseの`v0.3.0`とは区別します。
npm publishは行いません。Draft Pre-releaseの作成と一般公開は別操作です。
以下は管理者向けの手順であり、この文書を追加しただけではタグ・Draft・公開は作成されません。

## 1. 候補を固定する

変更をcommit・pushしてreviewを完了し、候補commitの通常CIを確認します。
配布CIの6対象と、既存portable CIの6構成の両方が成功している必要があります。
CLIのversionと[release notes](../packages/cli/distribution/RELEASE-NOTES.md)を確認します。
同じversionを使い回さず、修正で配布物が変わる場合は新しい候補versionを付けます。

対象commitを明示して、承認後にタグを作成します。

```sh
git tag -a build-tools-v0.3.1-alpha.1 APPROVED_FULL_COMMIT_SHA -m "Matra build tools 0.3.1-alpha.1"
git push origin refs/tags/build-tools-v0.3.1-alpha.1
```

タグは移動・上書きしません。workflowがdefault branchに存在しない間は、
GitHubのworkflow_dispatchを利用できない場合があります。先にworkflowをdefault branchへ導入するか、
利用可能になってから実行してください。

## 2. 手動CIでDraftを準備する

```sh
gh workflow run distribution.yml \
  --ref build-tools-v0.3.1-alpha.1 \
  -f create_draft=true
```

通常のpush・PR・入力なしの手動実行ではDraftを作りません。
通常CIでも6対象のZIPをLinuxへ集約し、checksum・出典・compilerの一致と展開互換性を検証します。
WindowsのZIP entryも`/`区切りで保存し、他OSで警告なく展開できることを確認します。
lockfileとCoreのparser生成元・生成先はLFでcheckoutし、Windowsの改行変換による
checksumの差異やparser再生成後のdirty sourceを防ぎます。
CoreのTypeScript出力もLFで固定し、Windowsの既定改行による追跡済み生成物の差分を防ぎます。
追跡済みの生成JS・型定義もLFでcheckoutし、再生成前後でGitの改行属性を一致させます。
手動の`create_draft=true`だけが、次のすべてを満たした後にDraftを作成します。

1. 既存タグのcommitとcheckoutしたHEADが一致し、sourceがcleanである
2. 6対象のnative CIでinit/build/dev・ZIP再展開検証が成功する
3. 今回のrunから12ファイル（ZIP 6つとchecksum 6つ）だけを取得する
4. 各ZIPのchecksum、配布version、対象、source commit、dirty=false、lockfile checksum、
   Node.js pin、package version、compiler manifestとWasmのhashを検証する
5. 日英release notesを付けて`--draft --prerelease --latest=false --verify-tag`で作成する

Draft作成jobだけに`contents: write`を与え、通常のbuildはread権限で実行します。
既存releaseは上書きしません。失敗時はrunログとDraftの実際の状態を確認してください。
Draft作成後にasset添付が失敗した場合、部分的なDraftが残る可能性があります。
自動削除・再公開はせず、承認を得てDraftを整理してから再実行します。

## 3. 公開前の確認

- Draftのタグ・commit・version・6対象のZIPとchecksumを確認する
- 同梱のライセンス、日英の導入手順、制限、署名・公証なしの記載を確認する
- DraftからZIPを実際にdownloadしてchecksumを検証する
- macOS / Windowsの実機で展開・PATH設定・init/build/devを試す
- WindowsのCtrl+CとmacOSのdownload承認は対話操作でも確認する
- Linuxはglibc環境向けであることを確認する（Alpine / muslは対象外）

自動CIはGatekeeperやWindowsの対話操作、未知の全環境を保証しません。
失敗時は公開を止めて新しい候補を作ります。ZIPのbyte再現性は保証しません。

## 4. 承認後だけ公開する

Draftの内容と実機確認結果を共有し、別途公開承認を得てから実行します。

```sh
gh release edit build-tools-v0.3.1-alpha.1 --draft=false --prerelease --latest=false
```

公開後もPre-release扱いを維持し、latestや安定版にはしません。

## 初回の実験的公開

`0.3.1-alpha.1`は興味のある開発者向けの試験配布として6対象の既存ZIPを公開する承認を得ました。
2026-10-31に[Pre-release](https://github.com/matralang/matra/releases/tag/build-tools-v0.3.1-alpha.1)として公開しました。
sourceは`164b168f8e0d38501db934ff7f79141c4c04cf3b`、
[作成CI](https://github.com/matralang/matra/actions/runs/41039927410)は全job成功です。
Draftの全12添付物の取得と出典検証、macOS arm64の実ZIP検証を完了しました。
Windows Chromeの危険ブロックは原因未特定、Windowsの対話操作とmacOSのdownload承認は未確認として、
releaseページとREADMEへ明記します。誤検知や安全性を断定せず、警告時は取得・実行を止める案内とします。
これは初回の公開判断の記録で、将来の候補の失敗を自動的に許容する規則ではありません。
release本文だけを更新し、既存ZIP・checksum・タグは変更しません。
同梱READMEには後から報告されたChromeの問題がないため、取得前にreleaseページの最新案内を確認してください。
npm公開・website deployは行いません。

## npm導入経路の公開準備

技術書典向けに、Node.js 22/24とnpmを利用する別経路を用意しました。
CLI `0.3.2-alpha.0`とStyles `0.1.0`はnpm公開済みの実験版です。
キャンペーンの案内・サポート期間を限定することと、配布物の利用期限は別です。
期間やサポート内容は未決定で、公開したpackageを期間終了時に削除しません。
既存のZIPとGitタグは変更していません。

利用コマンドは次のとおりです。

```sh
npm install --global @matra/cli@0.3.2-alpha.0
matra --version
matra init hello
cd hello
matra build
matra dev
```

`hello`は存在しないディレクトリとし、`dist/index.html`または表示されたlocalhostのURLで
結果を確認します。ブラウザの再読み込みは手動、終了はCtrl+Cです。WindowsではPowerShellでも
同じコマンドを使います。グローバルコマンドが見つからない場合はnpm prefixとPATHを確認します。
PowerShellのスクリプト実行制限により失敗する場合は`npm.cmd`と`matra.cmd`を使います。
buildは文書中のJavaScriptを実行するため、信頼する文書だけを使ってください。
OS sandboxとtimeoutは保証しません。npm導入はNode.jsが必要で、同梱ZIPとは別経路です。

公開前に、cleanな候補commitを固定し、CLIが依存するCore・HTML・site-generationの
指定versionとnpm上の実物・integrityを照合します。CLIとStylesをpackし、
Windows/macOS × Node.js 22/24の[専用CI](../.github/workflows/npm-cli.yml)で
隔離prefixへのnpm global install、`--version`、init/build/devを確認します。
この検証は未公開StylesのtarballをCLIと同時にインストールするため、
registry上のCLI単独インストールを保証するものではありません。
実機でPATH設定、ブラウザ表示とCtrl+Cも確認します。候補の修正後は再検証します。

公開は別途承認を得た後に行います。npm上のversionが未使用であることと公開権限を確認し、
Stylesを先に、CLIを後に`preview`タグで公開します。公開後、空の環境で
CLIのみを上記コマンドでregistryから取得し、init/build/devとintegrityを再確認します。
失敗時はwebsiteを公開せず原因を調査し、必要なら新versionを準備します。
websiteの準備中表示を外すのはregistry検証と公開承認の後です。

```sh
pnpm --filter @matra/styles publish --tag preview --access public
pnpm --filter @matra/cli publish --tag preview --access public
npm view @matra/styles@0.1.0 dist.integrity
npm view @matra/cli@0.3.2-alpha.0 dist.integrity dependencies
```

### 2026年11月7日の公開記録

承認に基づき、source commit `e378ed600a267b75cf70cafd08b7bf31246f2212`から
Styles `0.1.0`、CLI `0.3.2-alpha.0`の順にnpm公開しました。専用branchからの公開に
`--no-git-checks`を使用し、事前にcleanなcheckoutとremoteのcommit一致を確認しました。
[npm CLI CI](https://github.com/matralang/matra/actions/runs/42368119700)の4構成、
[ZIP配布CI](https://github.com/matralang/matra/actions/runs/42368119652)と
[portable CI](https://github.com/matralang/matra/actions/runs/42368119621)の6構成が成功しました。
Windows 11 x64 / Node.js 24.19.0で利用者がtarballを実機導入し、init/build、
ブラウザ表示とCtrl+Cを確認しました。macOS arm64 / Node.js 24.17.0では
registryからCLIのみを隔離prefixに導入し、init/build/devとブラウザ表示を確認しました。
両packageのregistry integrityは候補commitのpackと一致しました。

- CLI integrity: `sha512-1SBVjZgfLn2ammi+8K7j3EeYnL4CNZVRiN+UAw+ZsZQCzHurca4Qj5xx0EVBBp49L1dM/dVHwQBD9xlAqpQQeQ==`
- Styles integrity: `sha512-wwaL93dZ83xir5ygumYpcD/2DHwyuS9XxJ/Y2ar4oINthOWOlyb1Y+s+dD+SZnKolHRifDfgFF7HvzoBLiHzLw==`
- 両packageに`preview`と`latest`が付いています。CLIの`latest`は公開前の`0.0.0-stage`から
  実験版`0.3.2-alpha.0`へ変化しました。復元せず進める利用者の判断を記録します。
- 既存ZIPやGitタグは変更していません。Windows実機でのregistryからの再導入は未確認です。
