# Matraビルドツール

[English](./README.md) | [日本語](./README.ja.md)

Node.js同梱の実験的なフォルダー配布です。内部ファイルは個別に移動しないでください。
利用時にシステムのNode.js・npm・pnpm・Rust・ネットワーク接続は不要です。
初版はApple SiliconのmacOS向けです。他のOS・CPU向けの配布はまだ提供しません。

## 始め方

ZIPを展開し、展開したフォルダーをターミナルのPATHへ追加します。
下記のパスを実際の展開先へ置き換えてください。グローバルインストールは行いません。
起動コマンドへのsymlinkではなく、実体のフォルダーを指定してください。

```sh
export PATH="/absolute/path/to/extracted-matra-folder:$PATH"
matra --version
matra init hello
cd hello
matra build
open dist/index.html
```

`hello`はまだ存在しないディレクトリを指定します。`index.md`と`matra.css`を編集し、
再buildしてください。ローカルサーバーで確認する場合は次を実行します。

```sh
matra dev
```

表示されたURL（標準は`http://127.0.0.1:3000/`）を開きます。
変更すると自動で再buildします。ブラウザは手動で再読み込みしてください。
Ctrl+Cで停止します。ポートが使用中なら`matra dev --port 3001`で変更できます。

文書内のJavaScriptを実行するため、信頼する文書だけをbuildしてください。
OS sandbox・timeoutは保証しません。サーバーは生成HTML・CSS・CSSライセンスだけを配信します。
buildエラーはターミナルに表示し、修正されるまでHTTP 503を返します。
インターネットから取得したソフトウェアはmacOSで実行承認が必要になる場合があります。
この開発版は署名・公証を行っていません。組織のセキュリティポリシーに従ってください。

## 内容と出典

- `matra`：フォルダー内のNode.jsを使う起動コマンド
- `runtime/bin/node`：version固定の公式Node.jsバイナリ
- `app/node_modules/`：CLI・ライブラリ・compiler Wasmとmanifest・テンプレート
- `LICENSE`・`licenses/`：Matraと依存ライブラリ、Node.js内の依存を含むライセンス情報
- `versions.json`：各version、Node.js取得先とchecksum、compiler manifest、
  source commit・作業ツリー変更の有無・依存lockfileのchecksum

ZIPに添付する`.zip.sha256`はZIP自体のSHA-256です。
正式公開やZIPのbyte単位の再現性を保証するものではありません。
フォルダー全体とライセンス情報を一緒に保持してください。
