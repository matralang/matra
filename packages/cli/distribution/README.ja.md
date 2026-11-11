# Matraビルドツール

[English](./README.md) | [日本語](./README.ja.md)

Node.js同梱の実験的なフォルダー配布です。内部ファイルは個別に移動しないでください。
`init`、`build`、`site`、`dev`にはシステムのNode.js・npm・pnpm・Rust・network接続は不要です。
`deps install`にはnpm、pip付きPython 3、network接続が必要です。
macOS・Linux・Windowsのx64 / arm64向けに、対象環境上で配布物を作成します。
自分のOS・CPUと一致するZIPを選んでください。Linuxは公式Node.jsが対応するglibc環境向けで、
Alpine / muslは対象外です。CI検証と正式releaseの公開は区別します。

## 始め方

ZIPを展開し、展開したフォルダーをターミナルのPATHへ追加します。
下記のパスを実際の展開先へ置き換えてください。グローバルインストールは行いません。
起動コマンドへのsymlinkではなく、実体のフォルダーを指定してください。

macOS / Linuxの場合：

```sh
export PATH="/absolute/path/to/extracted-matra-folder:$PATH"
matra --version
matra init hello
cd hello
matra build
```

Windows PowerShellの場合：

```powershell
$env:Path = "C:\path\to\extracted-matra-folder;$env:Path"
matra --version
matra init hello
cd hello
matra build
```

`dist/index.html`をブラウザで開いてください（macOSでは`open dist/index.html`）。
Windowsの起動コマンドは`matra.cmd`、macOS / Linuxは`matra`です。
ダブルクリックではなく、ターミナルから実行してください。
`hello`はまだ存在しないディレクトリを指定します。`index.md`と`matra.css`を編集し、
再buildしてください。ローカルサーバーで確認する場合は次を実行します。

```sh
matra dev
```

表示されたURL（標準は`http://127.0.0.1:3000/`）を開きます。
変更すると自動で再buildします。ブラウザは手動で再読み込みしてください。
Ctrl+Cで停止します。ポートが使用中なら`matra dev --port 3001`で変更できます。

`matra build`は`index.md`で選択されたJavaScriptを実行し、`matra site build`は明示した
`.matra.md`ページとlayoutだけを実行します。サイトの通常のMarkdownは文書データです。
信頼するプログラムだけをbuildしてください。OS sandbox・timeoutは保証しません。
サーバーは生成HTML・CSS・CSSライセンスだけを配信します。
buildエラーはターミナルに表示し、修正されるまでHTTP 503を返します。
インターネットから取得したソフトウェアはmacOSで実行承認が必要になる場合があります。
この開発版は署名・公証を行っていません。組織のセキュリティポリシーに従ってください。

Front Matterにpackage名を記述し、build前に`matra install`（`matra deps install`も同義）で両方を準備します。
省略時は`index.md`を使い、別の文書は`matra install DOCUMENT`で指定します。
`matra deps install npm DOCUMENT`と`matra deps install python DOCUMENT`で個別にも準備できます。
versionは自動解決して文書別lockに保存し、
生成物は`.matra/deps/`以下にまとめます。PythonはPyodide互換`py3-none-any` wheelを使います。
network access前に確認し、npm lifecycle scriptは無効にします。Python wheel用のPython 3/pipは
システムに別途必要です。同梱配布物にはpackage managerを含みません。

## 宣言的なサイト

複数ページサイトでは、project rootに`matra.site.yaml`、`matra.site.json`、
`matra.site.matra`のいずれか1つを置き、次を実行します。

```sh
matra site build
```

設定したpages directory以下の通常の`.md`はMarkdownページです。
実行するページとlayoutだけを`.matra.md`にします。routeに対応するHTMLを
設定した出力directoryへ生成します。詳細は
[サイト生成の実装契約](https://github.com/matralang/matra/blob/main/spec/site-generation.ja.md)を参照してください。

## 内容と出典

- `matra`（macOS / Linux）・`matra.cmd`（Windows）：同梱Node.jsを使う起動コマンド
- `runtime/bin/node`（macOS / Linux）・`runtime/node.exe`（Windows）：固定versionの公式Node.js
- `app/node_modules/`：CLI・ライブラリ・compiler Wasmとmanifest・テンプレート
- `LICENSE`・`licenses/`：Matraと依存ライブラリ、Node.js内の依存を含むライセンス情報
- `versions.json`：各version、Node.js取得先とchecksum、compiler manifest、
  source commit・作業ツリー変更の有無・依存lockfileのchecksum

ZIPに添付する`.zip.sha256`はZIP自体のSHA-256です。
正式公開やZIPのbyte単位の再現性を保証するものではありません。
フォルダー全体とライセンス情報を一緒に保持してください。
