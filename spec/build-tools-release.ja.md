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
後続のCLI `0.3.2-alpha.1`も2026年11月12日に公開しました（公開記録を参照）。
キャンペーンの案内・サポート期間を限定することと、配布物の利用期限は別です。
期間やサポート内容は未決定で、公開したpackageを期間終了時に削除しません。
既存のZIPとGitタグは変更していません。

利用コマンドは次のとおりです。

```sh
npm install --global @matra/cli@0.3.2-alpha.1
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
指定versionとnpm上の実物・integrityを照合します。CLI・Core・site-generationをpackし、
変更のないCommand `0.1.0`とStyles `0.1.0`はregistryのtarballを取得して、Windows/macOS × Node.js 22/24の
[専用CI](../.github/workflows/npm-cli.yml)で隔離prefixへのnpm global install、
`--version`、init/build/dev、部品の生成と失敗時の出力保持を確認します。この検証は
候補Core・site-generationのlocal tarballと既公開Command・StylesをCLIと同時にインストールするため、registry上のCLI単独installを
保証するものではありません。実機でPATH設定、ブラウザ表示とCtrl+Cも確認します。
候補の修正後は再検証します。

公開は別途承認を得た後に行います。npm上のversionが未使用であることと公開権限を確認し、
Coreを先に、その依存先のCommandとsite-generationを次に、最後にCLIを`preview`タグで公開します。
Styles `0.1.0`は公開済みです。公開後、空の環境で
CLIのみを上記コマンドでregistryから取得し、init/build/devとintegrityを再確認します。
失敗時はwebsiteを公開せず原因を調査し、必要なら新versionを準備します。
websiteの準備中表示を外すのはregistry検証と公開承認の後です。

```sh
pnpm --filter @matra/core publish --tag preview --access public
pnpm --filter @matra/command publish --tag preview --access public
pnpm --filter @matra/site-generation publish --tag preview --access public
pnpm --filter @matra/cli publish --tag preview --access public
npm view @matra/core@0.3.1-site.1 dist.integrity
npm view @matra/command@0.1.0 dist.integrity dependencies
npm view @matra/site-generation@0.1.0-site.3 dist.integrity dependencies
npm view @matra/styles@0.1.0 dist.integrity
npm view @matra/cli@0.3.2-alpha.1 dist.integrity dependencies
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

### 2026年11月12日の公開記録

承認に基づき、source commit `e297c3cbfe1eacf96609da0c0e3fa46bb6ba1d41`から
Core `0.3.1-site.1`、Command `0.1.0`、site-generation `0.1.0-site.3`、
CLI `0.3.2-alpha.1`の順にnpm公開しました。公開当時の4 packageの`preview` tagは候補を指し、
`latest`は従来の値を維持しています。Styles `0.1.0`は既公開です。
[npm CLI CI](https://github.com/matralang/matra/actions/runs/43127441219)、
[配布CI](https://github.com/matralang/matra/actions/runs/43127441245)の6対象、
[portable CI](https://github.com/matralang/matra/actions/runs/43127441444)がすべて成功しました。

- Core integrity: `sha512-FIV721ltIYt8Mwyhn6aI6C+gAIR/X81LvMxqpmH97FJ2Et7LhnmklBMfnKMiZg2NMx534E6Jicna8WiwjtZ3Zw==`
- Command integrity: `sha512-u3TR7t6fzevxw818+DuoOezqqse6kW6PmYq7QNfve5p6rc5ZqgPZ88p8axkvlLtANjiUk4n+JAjZVtSz1flfrQ==`
- site-generation integrity: `sha512-jWgjfG7i247ge8IB6juGpuM3O1b7eVh2pHSflT2rxVALNTciXjHA9S5oojdg6oMWECvfAlhBvGzeo3ZUx08TQg==`
- CLI integrity: `sha512-Eszw10KYemu0VIw4CORQzCfbURWrK0AFq9FxE2l2n5b3kDaNsKsriUkWSKCkLtolBgy4pNjNua1a1uxgNJmLOA==`
- Styles integrity: `sha512-wwaL93dZ83xir5ygumYpcD/2DHwyuS9XxJ/Y2ar4oINthOWOlyb1Y+s+dD+SZnKolHRifDfgFF7HvzoBLiHzLw==`

Node.js 24.17.0 / npm 11.13.0のmacOS環境で、registryからCLI単独を一時prefixへglobal installし、
registry tarballとintegrityが一致すること、`matra --version`、init/build/devを確認しました。
Windows実機でのregistry installと対話的な操作は未確認です。npm package公開のみを行い、
website deploy、既存ZIP、Git tagは変更していません。

### Core browser向け公開記録

2026年11月12日、承認に基づきsource commit `c483462263bf5ef7abada1bcca556d03a3f5d11c`から
Core `0.3.1-site.2`をnpm公開しました。`preview`はこのversionを指し、
`latest`は`0.3.0`のままです。他package、website deploy、既存ZIP、Git tagは変更していません。
[npm CLI CI](https://github.com/matralang/matra/actions/runs/43144528020)、
[配布CI](https://github.com/matralang/matra/actions/runs/43144527886)、
[portable CI](https://github.com/matralang/matra/actions/runs/43144527820)が成功しました。

- Core integrity: `sha512-WulRgpt6STO9WgM5Sw06qzPQlUIIPvwyKSTTgsDtDORtAzruRwI8tadFaSluWBT5lkfgufrvIfXRARr1qkkl8w==`
- macOS / Node.js 24.17.0 / npm 11.13.0で、registryから新規consumerへ導入し、
  同期・非同期browser entryとJavaScript blockを確認しました。registry integrityは
  事前に検証したtarballと一致しました。
- Core単体のminify・ESM分割計測は初期16,045 bytes、追加122,139 bytes、
  総量138,184 bytesです。websiteとWorker全体の容量・browser動作は未検証です。

### 次候補

関数形式のMatra部品を含むnpm候補を準備します。公開はまだ行っていません。

| Package | 候補version | pack時の関連依存 |
| --- | --- | --- |
| `@matra/core` | `0.3.1-site.3` | compiler ABIは`matra-value-1`のまま |
| `@matra/site-generation` | `0.1.0-site.4` | Core `^0.3.1-site.3`、HTML `^0.3.1-site.0` |
| `@matra/cli` | `0.3.2-alpha.2` | Core `0.3.1-site.3`、site-generation `0.1.0-site.4` |

Command `0.1.0`、HTML `0.3.1-site.0`、Styles `0.1.0`は再公開しません。
既公開CommandのCore依存`^0.3.1-site.1`は候補Coreも受理するため、
registryのCommand・Stylesと候補3 packageを使った隔離npm installで実際の解決先を検証します。
候補versionは準備時のregistry一覧では未使用です。公開直前にも再確認します。

部品は`site.components`で登録した`.matra`に`fn Card(props, children) { ... }`として定義し、
ページ・layoutから`Card({ title: "見出し" }, [p { "本文" }])`で呼び出します。
通常のHTMLへ展開し、Shadow DOM・新文法・JavaScriptからの直接ページ登録APIは含みません。
候補のpackと隔離installでは、依存version・Coreの解決先、init/build/install/dev、
Markdownと実行ページの部品再利用、入れ子、escape、basePath、
循環エラー時の旧HTML・manifest保持を確認します。

公開前には変更をcommit・pushしてcleanな候補commitを固定し、更新したnpm CLI CIの4構成、
配布CIの6対象、portable CIを確認します。ローカル検証だけで他OS・Node.js版の成功とはしません。
既存のZIP、Git tag、website deploy、npmのtagは準備作業では変更しません。
公開は別途承認を得た後、Core → site-generation → CLIの順で`preview`へ行い、
`latest`は維持します。Commandは上記の旧手順例とは異なり、この候補ではpublishしません。
公開後はregistryからCLI単独を導入して再検証します。

#### ローカルの準備検証

macOS arm64 / Node.js 24.17.0 / npm 11.13.0で、候補3 packageのpack、
既公開Command・Stylesのregistry tarballとの隔離global install、上記のsmoke検証が成功しました。
HTMLもregistryの`0.3.1-site.0`を使い、CLI・site-generation・CommandのCore解決先が
候補`0.3.1-site.3`で一致することを確認しました。
関連40 test、`pnpm run lint`（build・型checkを含む）、`git diff --check`も成功しました。
Coreのtarballには新APIの型定義とcompilerを含み、compiler manifestのversion・ABI・hashと
Stage 2/3一致の記録を確認しました。Windows、Node.js 22、remote CIはこの候補では未確認です。
検証したtarballのintegrityは次のとおりです。候補の修正・再pack後は再検証します。

- Core: `sha512-6/T6kS8NqlLZ7P5UhXmDz6zRmYENkuy85TKJaKPT9zHkqRhx6Y9pK3xycnPBTF/4KQ4f1GXvaD7G+1la7Yzc5Q==`
- site-generation: `sha512-DTFuQuiKGI048SbBq87GR5k40cJMDAQ4mFKh3I2dOxJsabooHcZqsHNPBbShlGR3oj+rhk1XVb8rkdlU/ajK/Q==`
- CLI: `sha512-quUxdEFH1M7F0NYWIxA0HCzh6BBn34miVItoBMBSkGZ4XFwLFiSn8KQ6KZr8m4om28qhb0ZvTMb3RVVpuKRRDA==`
