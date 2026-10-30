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

この操作は今回の準備範囲に含みません。公開後もPre-release扱いを維持します。
