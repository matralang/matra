# Matra Website

[English](./README.md) | [日本語](./README.ja.md)

Matraの公式サイトです。現在はGitHub Pagesでpreviewし、最終的に
`https://matralang.org` をcanonical domainとして運用します。

## Development

```sh
cd ../..
pnpm install
pnpm --filter @matra/website run dev
```

`dev`はsiteをbuildし、`http://localhost:3000`で`dist`をserveします。`src/`配下の変更時には再buildします。

Websiteと`@matra/*`は同じnpm workspaceで管理しています。`file:`指定や
`pnpm link`を使わなくても、packageの変更はローカルのWebsiteに反映されます。

## Information architecture

| Primary URL | Purpose | Future subdomain |
| --- | --- | --- |
| `/` | 公式トップ・入口 | `matralang.org` |
| `/docs/` | ドキュメント入口 | `docs.matralang.org` |
| `/spec/` | 言語仕様 | `docs.matralang.org/spec/` |
| `/play/` | Playground | `play.matralang.org` |
| `/examples/` | 作例 | — |
| `/packages/` | パッケージ一覧 | `api.matralang.org` |
| `/blog/` | 開発記録 | `blog.matralang.org` |

ページは`src/pages`配下のMarkdownファイルで管理します。nativeな`*.matra` pageはfront matterに`title`、`description`、`layout`を指定し、fenced code blockには`main`の中身だけを記述します。HTML documentは共通layoutが生成します。スタイルは`src/styles`に置きます。
再利用するsourceは名前付きMarkdown fenceへ置き、Matra elementの`src="matra:filename"`から参照します。build時に対応するfenceのtext contentが注入されます。
ビルドは各Markdown文書からMatra code blockを抽出してparseし、HTMLへrenderします。
繰り返し要素を生成するページは`page.program.matra` fenceを使います。front matterと共通layoutは静的ページと同じです。既存の標準文法の`fn`、`for`、member access、`...`でnodeを直接生成し、build時に`evaluate()`で明示的に実行します。`page.matra`は引き続き`evaluateStatic()`だけを使い、実行へのfallbackはしません。
TypeScriptとの連携が必要な場合は、信頼済みの`*.matra.ts` fenced code blockを使えます。これはbuild時にJavaScriptとして実行されるため、repository内で管理するsourceだけに使用してください。
`.matra.ts`は有効なTypeScript moduleとして、`export default matra\`...\``の形で記述します。
GitHub Pagesのproject pathはworkflowから`SITE_BASE_PATH`として自動設定されます。

## 運用メモ

Website側の文書は、language specificationやpackage READMEへ導線を張る入口として扱います。仕様の規範的な内容は`spec`、package APIの詳細は各`packages/*`に置き、Websiteは閲覧体験とPlaygroundへの導線を担います。

## Matra Programへの移行と改善案

Docs、Packages、Specification入口はMatra Programへ移行しました。カードのsource文字列生成、`JSON.stringify()`、`matra.raw()`が不要になり、データとnode構築を同じ文法で読めます。文法・ABIの変更はありません。

現行仕様で置き換えにくい部分と、今後の改善候補は次のとおりです。

- **共通componentのimport**: 一般Programにはmodule importの契約がありません。カード関数はページごとに定義しています。相対path、export、循環参照、診断位置を定めたmodule仕様があれば、共通layoutやnavigationもMatraで再利用できます。
- **文字列の加工**: `String()`や`padStart()`などの標準関数はありません。今回は番号をデータの`"01"`〜`"04"`として持たせました。数値の文字列化とpaddingの標準APIがあれば自動採番できます。構文変更より標準libraryの契約が適しています。
- **文字列escapeと複数行text**: 標準文法はこれらを拒否します。HTML例やJavaScriptをProgram内へ直接保持しにくいため、名前付きfenceのtext注入を維持しています。escapeまたはraw stringの仕様があれば、引用符・改行を含むtextも扱いやすくなります。
- **ブラウザとbuildのhost API**: DOM、Worker、filesystem、esbuildのAPIは一般Programから利用できません。Playground操作とbuild処理はTypeScriptに残しています。移行には文法だけでなく、非同期処理・event callback・許可するhost capabilityの契約が必要です。

これらは提案であり、今回の変更では仕様を拡張していません。文法を変更する場合は日本語・英語の正本を先に更新し、parserと実行結果の共通検証を追加します。
