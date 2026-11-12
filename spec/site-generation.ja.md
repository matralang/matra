# Matraを使う宣言的サイト生成（追加設計案）

[English](./site-generation.md) | [日本語](./site-generation.ja.md) | [索引](./README.ja.md)

## 状態と対象

本書は、[共通ビルドエンジンの初期案](./desktop-app.ja.md)を補足します。
段階1〜2のMVPは実装済みです。外部データ拡張、変更監視、公式サイトへの適用は将来案です。
MVPの入力契約と設定例は本書の「MVPの実装契約」に従います。
Desktopの初版を成立させる前提条件にはしません。

対象はMatraを使うサイト生成機能であり、Matra Program・compiler sourceの文法変更ではありません。
parser、AST/data model、compiler ABI、既存のCore・HTML APIの既存動作は維持します。
`runLiterate()`には、plain dataを複製して渡す追加の`globals` optionを設けます。
[文法仕様](./grammar.ja.md)と[literateの初版契約](./literate-modules.ja.md)を上書きしません。

## MVPの実装契約

サイト生成は既存の単一ページ`matra build`とは別に、`matra site install`と
`matra site build`で操作します。installは設定済みの実行ページとlayoutの依存を準備します。
共通エンジンのpackageは`@matra/site-generation`です。設定ファイルは次のいずれか1つだけを置きます。

- `matra.site.yaml`: YAML
- `matra.site.json`: JSON
- `matra.site.matra`: Matraの静的なobject expression（例: `({ version: 1, site: { pages: "pages" } })`）

形式に関係なく、設定は同じversioned schemaを使います。未知の設定、Matra設定の動的評価、
project root外の入出力パスは拒否します。

```yaml
version: 1
site:
  pages: pages
  documents: content
  layouts: layouts
  defaultLayout: default
  output: dist
  format: directory
  assets: public
  basePath: /preview
  data:
    title: My site
```

`site.pages`以下の通常の`.md`はFrontMatterなしでも公開するMarkdownページです。
実行するページとレイアウトは`.matra.md`に限定し、literate FrontMatterの`matra.entry`で入口を指定します。
`site.documents`は追加の文書root（パスまたはパス配列）で、収集した文書は自動公開しません。
ページ・レイアウトのFrontMatterにある`site`は`route`、`layout`、`data`だけを受け付けます。
`site.data`を指定した場合、同じFrontMatterの通常項目との併用は拒否します。

レイアウト入口には`site.data`、`site.documents`、`page.data`、`page.route`、`page.content`を渡します。
`page.content`はHTML文字列ではなく文書ノード列です。値はliterate runtimeでplain dataとして検証・複製され、
選択済み`.js.part`の公開名との衝突は診断になります。
Markdown変換はmarkdown-itの標準設定（HTML無効、linkify/typographer無効）を使います。
テーブルと取り消し線を含み、raw HTMLはノードとして実行せず文字列としてHTML escapeします。

directory形式では`pages/index.md`が`/`、`pages/about.md`が`/about/`、
`pages/blog/post.md`が`/blog/post/`になります。`flat`形式では末尾slashを除き、
それぞれ`index.html`、`about.html`、`blog/post.html`へ出力します。
`site.assets`のregular fileは出力の`assets/`以下へコピーし、入力symlink、衝突、欠落したローカル参照を拒否します。
`basePath`はHTML出力時のroot-relative `href`・`src`に適用します。

全ページを生成・検証してから、既存出力を一時directoryへ複製して新しいファイルを重ね、
directoryをswapして公開します。出力内の予約ファイル`.matra-site-manifest.json`に
`{ "version": 1, "files": [...] }`として生成HTML・assetの相対パス一覧を保存します。
一覧のパスは`/`区切りで安定順序とし、一覧自体は`buildSite()`の戻り値へ含めません。
次回の成功buildでは、前回一覧にあり今回生成しないファイルだけをステージ内で削除します。
ページ・assetの削除、route変更、directory/flat切り替えに適用し、空になった祖先directoryだけを除去します。
一覧にない既存ファイルは保持します。生成物はエンジン所有とし、手動編集しても保護対象にはしません。
一覧がない旧版出力は所有権を推測せず保持するため、初回移行時の古い出力は利用者が確認・整理してください。
予約ファイルは手動編集せず、routeの出力先にも使用できません。不正JSON・非対応version・重複パス・
出力外へ逸脱するパス・symlink・想定外のファイル種別は診断にし、黙って一覧を捨てません。
生成・検証・公開に失敗した場合は旧出力と一覧を維持します。
外部拡張、watch、canonical URL生成、Desktop統合、公式サイト移行は含みません。

## 再利用可能なMatra部品

`site.components`に部品ディレクトリを指定すると、その配下の`.matra`を部品として登録します。
省略時は部品を収集しません。指定したディレクトリは存在する必要があり、
ほかの入力と同じproject root内・symlink禁止・outputとの重複禁止の検証を適用します。
部品は公開ページでもliterate文書でもなく、FrontMatterやfenceは不要です。
`matra site install`の依存install対象にも含めません。

```yaml
version: 1
site:
  components: components
  defaultLayout: default
```

部品ファイルには、引数が2つのトップレベル`fn`を1つだけ定義します。
公開名はファイル名でなく関数名で、ディレクトリ全体で大小文字だけ異なる名前も重複として拒否します。
以下は`components/Card.matra`の例です。

```matra
fn Card(props, children) {
  article.card {
    h2 { props.title }
    ...children
  }
}
```

実行ページとlayoutは、既存の関数呼び出しで部品を使えます。

```matra
main {
  Card({ title: page.data.title }, [
    p { "本文" }
  ])
}
```

- 引数はpropsのplain objectとchildrenの配列の2つを必須とします。
  childrenなしは`[]`を渡します。parameter名自体は任意です。
- 部品は単一の文書ノードを返します。文字列・配列・nullなどの戻り値は診断にします。
  childrenはHTML文字列へ変換せず値として複製し、HTML escapeと`basePath`は最終出力時に適用します。
- 部品から別の登録済み部品を呼べます。直接・間接の循環呼び出しは呼び出し経路付きの診断にします。
- 呼び出しごとに独立したスコープを作り、props・childrenを複製します。
  呼び出し元の変数、`page`、`site`、JavaScript/Python値moduleは暗黙に参照できません。
  必要な値はpropsで明示的に渡します。補助関数・変数は部品関数の内側で定義できます。
- ページ・layoutの値moduleやhost globalと公開名が衝突する場合は診断にします。
  同じscopeでのローカル宣言との衝突は既存のduplicate-binding規則に従います。
- 構文・定義・実行エラーは元の部品ファイルを示し、実行エラーには呼び出し元文書と部品の呼び出し経路を含めます。
  部品の失敗でも新しい出力は公開せず、旧出力とmanifestを維持します。

これはsite-generationの互換拡張です。Matra Program・compiler sourceの文法、AST/data model、
compiler ABIは変更しません。`Card(title="...") { ... }`や`<Card>`によるcomponent呼び出し、
Shadow DOMとブラウザの状態管理は含みません。

## JavaScriptからの直接ページ登録

`@matra/site-generation`の`generateSite(options)`は、JavaScriptで作ったページ一覧を直接生成します。
既存の`buildSite(directory)`は維持し、このAPIでは設定ファイルやページ・layoutディレクトリを読みません。
ページdataのJSON化、FrontMatter、literate fence、中間ファイルは不要です。
以下はJavaScriptの配列`products`とMatraソース文字列`layoutSource`、`cardSource`を使う例です。

```js
import { generateSite } from "@matra/site-generation"

await generateSite({
  root: process.cwd(),
  data: { title: "商品一覧" },
  defaultLayout: "default",
  layouts: { default: { source: layoutSource } },
  components: { Card: { source: cardSource } },
  pages: products.map(product => ({
    kind: "matra",
    route: `/products/${product.slug}/`,
    source: "Card({ title: page.data.title }, [p { page.data.description }])",
    data: product,
  })),
})
```

layoutは例えば`html { head {}; body { ...page.content } }`という純粋なMatraソースです。
部品は既存と同じ`fn Card(props, children) { ... }`で定義します。
`page.data`からprops、propsから別部品への受け渡しに、シリアライズを挟みません。

### 入力と互換性

- `root`は既存のprojectディレクトリで、省略時は現在のディレクトリです。
  `output`、`format`、`assets`、`basePath`、`data`、`defaultLayout`はファイル方式と同じ意味・既定値です。
  outputにroot自身は指定できません。
- `pages`は必須の配列で、各項目は`kind`（`matra`または`markdown`）、`route`、`source`、
  省略可能な`layout`、`data`、`document`を持ちます。空配列も受理します。
  `layout: false`はlayoutを無効化し、未指定は`defaultLayout`を使います。
  `kind`は推測せず、Matra sourceのコンパイル失敗をMarkdownへfallbackしません。
- `layouts`と`components`は名前をkey、`{ source, document? }`を値とするobjectで、省略時は空です。
  部品のkeyは定義関数名と一致させます。大小文字だけ違うlayout名・部品名も重複として拒否します。
  layout・部品・ページの`source`は文字列であり、pathとして読み込みません。
  呼び出し側で`readFile()`したソースも、そのまま渡せます。
- `document`は診断・Markdown相対リンク用のproject相対論理パスです。実ファイルは作成しません。
  省略時はページが`pages/<routeから末尾slashを除いた部分>.matra`または`.md`
  （root routeは`pages/index.*`）、layoutが`layouts/<name>.matra`、
  部品が`components/<name>.matra`です。相対リンクはrouteでなくこのパスを基準に解決します。
  絶対パス、空segment、`.`・`..`、backslash、不正segment、大小文字を無視した重複、
  outputと重なる論理パスを拒否します。
- `documents`には参照専用Markdownを収集するディレクトリまたはその配列を指定できます。
  省略時は収集しません。登録したMarkdownページも`site.documents`に含み、
  そのIDは論理パス、metadataは`data`、contentは変換済みノードです。
  明示的な登録ページだけを公開し、収集文書は自動公開しません。
  重複IDや、収集文書の実パスと登録ソースの論理パスの重複は診断にします。
- Markdown sourceは本文そのものです。FrontMatterをデータやrouteの指示として解釈せず、
  fence内のMatra・JavaScriptも実行しません。ページ制御とdataはAPI引数に一本化します。
- 未知のoption・入力key、不正data・route・layout参照は診断にします。
  site/page dataはplain objectで、有限数、文字列、boolean、null、密な配列、plain objectのみを受理し、
  API呼び出し時に複製します。関数、undefined、class instance、循環、accessor、symbol propertyは拒否します。
  Matra・layout・部品のソースと登録情報も、最初の非同期処理前に検証・snapshotします。
- 描画・route/asset衝突・リンク解決・HTML escape・basePath・manifest・公開処理はファイル方式と共用します。
  成功時は生成ファイルの絶対パス配列を返し、失敗時は旧出力を維持します。
  同じroute・source・dataからはファイル方式と同じHTMLを生成します。

これはsite-generationとCore host APIの追加で、Matra Program・compiler sourceの文法、
AST/data model、compiler ABIは変更しません。JS設定ファイルの自動実行、CLIからの新APIの自動検出、
ファイル方式との暗黙merge、watch、JS/Python fenceの直接登録は対象外です。

## 目的

通常のサイトは宣言だけで生成し、用途固有の外部処理だけをコードで拡張できるようにします。
HTMLテンプレートに加えて、ページごとのデータ受け渡し、共通レイアウト、
ルートに応じたHTML出力を提供し、サイトごとのビルド用JavaScriptと独自プレースホルダーを減らします。
ファイル操作やCMS連携を言語本体へ組み込むことは目的にしません。
通常のMarkdownは、Nuxt Contentの`.md`文書のように、フォルダーとファイル名で存在する
文書データとして扱います。記事ごとにプログラム用の設定やコードを要求しません。

## 責務と現在の実装

| 層 | 責務 |
| --- | --- |
| Matra本体 | 値・関数・文書ノードの構築 |
| HTML出力 | 文書ASTのHTML化、HTMLとしてのエスケープ |
| 共通ビルドエンジン | 文書・ページ収集、標準Markdownの文書データ化、設定検証、データ受け渡し、レイアウト適用、ルートと出力先の決定、assets、診断、変更監視 |
| 外部拡張 | CMS取得、Markdownの追加構文・変換、画像処理など、用途固有の処理 |
| CLI・Desktop | 共通エンジンを呼び、操作・進捗・結果を表示 |

現行CLIの[`buildProject`](../packages/cli/src/project.mjs)は、単一の`index.md`を
literate APIでcompile・実行し、HTML・CSS・ライセンスを出力します。
[`別repositoryの公式サイト`](https://github.com/matralang/website)にはページ収集、メタデータ解釈、
出力先決定、共通要素の挿入があり、サイトごとの定型作業の具体例になります。
ただし、公式サイト固有の広告・計測・redirect処理までエンジンの既定動作にはしません。

## Markdown文書をデータとして扱う

### 文書とプログラムを分ける

サイト生成で収集する通常の`.md`は、既定で実行しない文書データとします。
FrontMatterなしでも受理し、`matra.entry`・`matra.values`・`site`やMatraのfenceを必須にしません。
コード例のfenceは表示用の本文であり、`.matra`や`.js.part`という名前でも自動実行しません。
本文やfenceの内容からプログラムを推測することも行いません。

実行するプログラム・テンプレート側に、明示的な識別の負担を置きます。
識別方法は、専用ディレクトリの登録、プログラム用FrontMatter項目、
複合拡張子（例：`.matra.md`）を候補とし、具体的な表記と優先順位は実装前に確定します。
既存の`matra.entry`を識別に使う場合も、サイト生成側の予約項目として明文化します。
文書モードに指定されたファイルではliterate設定らしい項目も実行の指示として解釈しません。
明示的な分類の矛盾やプログラム設定の不備は診断にし、文書へのfallbackで隠しません。

この分類は新しいサイト生成機能の入力契約です。既存CLIの`index.md`や、
明示的に呼び出す`buildLiterate()`がFrontMatterを要求する現行契約は変更しません。
Nuxt Contentと同じ使い勝手を目指すもので、同製品のAPI・拡張構文との互換性を宣言するものではありません。

### フォルダーとファイル名による収集・参照

たとえば、次のファイルだけで記事を追加できるようにします。

```text
content/
  about.md
  blog/
    first-post.md
```

`content/blog/first-post.md`の内容は、プログラム用設定なしの普通のMarkdownです。

```markdown
# 最初の記事

この文書はデータとして読み込み、Matraのテンプレートで表示します。
```

文書rootからの相対パス（例：`blog/first-post.md`）を文書IDとし、
root内の単一ファイルまたはフォルダー配下の文書列を宣言的に選択・参照できるようにします。
本文を設定ファイルへ列挙したり、記事ごとにJavaScriptのimportを書いたりする必要はありません。
フォルダーの収集順は文書IDで安定させ、欠落参照とIDの大小文字衝突は診断にします。
選択・参照の設定表記とMatra側の公開APIは未確定です。

文書データは、文書ID・相対パス・任意のFrontMatterメタデータ・本文ノード列・元位置を持つ
recordとして扱い、FrontMatterなしではメタデータを空objectとします。
メタデータとエンジンの識別情報は別の領域に置き、`title`などの任意の項目で文書IDを上書きしません。
メタデータはplain dataとして検証し、本文ノード列の元位置は診断用情報として別途保持します。
正確なrecord schema、見出しからtitleを導出するかなどの既定値は実装前に確定します。

### 文書データからページへ

文書の収集とHTMLページの公開は分けます。参照用に置いたMarkdownが自動で公開されることはありません。
プロジェクト側で、公開する文書フォルダーと共通テンプレート・レイアウトを一度指定すると、
文書ごとのプログラムやFrontMatterなしで、ファイル配置からルートを導出してページを生成できます。
単一文書をページデータへ渡す用途や、文書列から記事一覧を生成する用途も対象とします。
任意のFrontMatterはメタデータとして使えますが、ページ化の必須条件にはしません。

標準Markdownから文書ノード列への変換はサイト生成側が提供し、
Matraのテンプレート・レイアウトへ渡す本文は、プログラムの生成結果と同じ合成経路を使います。
HTML文字列のプレースホルダーや記事ごとの独自parserを要求しません。
raw HTMLは既定で実行可能なHTMLとして通過させず、扱いと対応Markdown dialectは実装前に確定します。
追加構文・変換は明示的な拡張で提供し、通常のコード例は実行対象にしません。

元文書の相対リンクと画像は、元ファイルのディレクトリを基準に解決し、
公開文書へのリンクはルート表、画像はassetsの出力計画に対応させます。
root外への参照や欠落したローカル参照は診断にします。
文書の追加・変更・削除を変更監視に含め、参照するページ・一覧も再生成します。

## 宣言的なページとレイアウト

### プロジェクトとページの設定

プロジェクト設定は、文書データとプログラムの入力・分類、文書の公開対象と共通テンプレート、
ページの入力ディレクトリ、名前付きレイアウトの文書、
共通サイトデータ、assets、出力形式、公開先のbase pathとoriginを指定するものとします。
通常のフォルダーと文書を使い、CLI・Desktopで同じ設定を読みます。
設定ファイルの名前・schema・version管理は実装前の未決事項です。

プログラムとして明示的に分類したページのFrontMatterでは、
literateの`matra`設定とは別の`site`項目をエンジンが解釈する案とします。
以下はプログラムページの設定例であり、文書データのMarkdownには要求しません。
YAMLを既存のloaderと整合する方法で読み、独自の行分割や文字列置換で解釈しません。
サイト生成の初版では、未知の`site`項目、不正な型、未知のレイアウトを診断にします。

```yaml
---
matra:
  entry: main.matra
site:
  route: /about/
  layout: default
  data:
    title: このサイトについて
    description: Matraでつくるサイト
---
```

`route`は省略時にファイル配置から導出します。`layout`はプロジェクトの既定値を使い、
レイアウトを使わず完全なHTML文書を返すページも明示的に指定できるようにします。
レイアウトを使わない指定の表記は未確定です。
`data`は省略時に空objectとし、必須データの不足を空文字列へ置き換えません。

### 実行時のデータ

エンジンが渡す公開値の案は次のとおりです。

| 公開値 | 内容 |
| --- | --- |
| `site.data` | プロジェクト共通のデータ |
| `page.data` | ページ固有のデータ |
| `page.route` | base pathを含めない論理ルート |
| `page.content` | レイアウト実行時だけ渡す、ページ本文の文書ノード列 |

共通データとページデータは別の名前で公開し、暗黙のdeep mergeや上書きをしません。
外部拡張が生成するページも同じページ記述形式を使い、FrontMatterと拡張の二重定義は衝突として扱います。
値はliterateのplain data subsetに合わせて検証・copyし、ページ間や本文・レイアウト間で
可変な実行状態を共有しません。公開root名と文書内binding・選択した値の衝突は診断にします。

現在の`runLiterate()`には、この外部データ注入を提供する公開契約はありません。
新しいhost連携は明示的なAPIとして設計し、データから`.js.part`のソースを生成して埋め込む方法や、
非公開runtimeの直接操作を採用しません。既存の`matra.entry`・`matra.values`の意味は維持します。

### 文書ノードとして合成する

プログラムページの`main.matra`は本文だけを返します。
文書データをページ化する場合は、Markdown変換と共通テンプレートがこの本文生成段階を担います。

```matra
article {
  h1 { page.data.title }
  p { page.data.description }
}
```

名前付きレイアウト`default`に対応する別のliterate文書も、明示的な入口を持ちます。
その入口のMatraコードでは、本文をノード列として受け取ります。

```matra
html(lang="ja") {
  head {
    title { page.data.title }
    meta(name="description" content=page.data.description) {}
  }
  body {
    header { a(href="/") { "My site" } }
    main { ...page.content }
    footer { "Built with Matra" }
  }
}
```

実行順は「ページ本文の生成 → 文書ノード列としての検証 → レイアウト実行 →
完成文書の検証 → HTML化」とします。初版はレイアウト1段を対象とし、継承や任意のhook列を導入しません。
本文をHTML文字列へ変換して再parseしたり、raw HTMLやプレースホルダーとして挿入したりしません。
通常の文字列はHTML出力時にエスケープし、HTML化は合成後に一度だけ行います。
レイアウト適用後（またはレイアウトなし）の結果は、単一の`html`と`head`・`body`を持つ完全な文書とし、
doctypeはエンジンが付加します。本文に完全なHTML文書を返して二重に包む場合は診断にします。

## ルートと出力の契約案

論理ルート、出力ファイル、公開URLは別の値として管理します。
文書の公開対象を`pages/`とした場合、既定のdirectory形式は次の対応を持ちます。

| 入力 | 論理ルート | 出力 |
| --- | --- | --- |
| `pages/index.md` | `/` | `dist/index.html` |
| `pages/about.md` | `/about/` | `dist/about/index.html` |
| `pages/blog/entry.md` | `/blog/entry/` | `dist/blog/entry/index.html` |

明示的な`route`はこの導出だけを上書きします。
プログラム用の複合拡張子を採用する場合は、その接尾辞を除いて同じルート規則を適用します。
文書・プログラム両方のページを同じルート表に登録し、相互の衝突も診断にします。
公式サイトの現行のflat形式（`/about`に対して`about.html`）も移行時に維持できるようにします。
どちらを使うかはプロジェクト単位で選び、暗黙に混在させません。
既存サイトのURLを自動変更せず、末尾slashのredirectや配信側のURL解決も移行時に確認します。

- ルートは`/`で始まる論理パスとし、query、fragment、backslash、`.`・`..`、
  root以外の空componentを拒否する。percent encoding・Unicodeの正規化規則は実装前に確定する。
- 末尾slashは出力形式に従って正規化し、正規化後の重複ルート、
  重複出力、大小文字だけの衝突、ファイルとディレクトリの衝突をassetsも含めて検出する。
- ルートから出力先へ変換した結果が出力ディレクトリ内にあることを検証する。
  出力先と祖先のsymlink・想定外のファイル種別を拒否し、現行CLIの安全検査を弱めない。
- 内部リンクとcanonical URLは同じルート表から導出する。
  base pathは公開時に一度だけ適用し、外部URL・query・fragmentを壊さない。
  canonical URLはoriginを設定した場合に生成し、レイアウトへの公開方法はAPI設計時に定める。

## 外部拡張

最初の拡張点は、ページ一覧とデータを用意する処理に限定します。
CMSなどから「ルート・使用するページテンプレート・データ・依存入力・元位置」の一覧を返し、
compile・レイアウト適用・HTML化・出力はエンジンに任せます。
自動のnpm解決や、エンジン内部を書き換える汎用hook機構は初版の対象外です。

エンジン側で非同期処理を完了してから、解決済みのplain dataをMatraへ渡します。
Promise、Matra関数のJavaScriptへの引き渡し、filesystem・network権限をMatra本体へ追加しません。
拡張は明示的に登録した信頼するコードとしてビルド用プロセスで実行し、OS sandboxとは扱いません。

拡張が報告する依存ファイルを変更監視の対象に含めます。
外部サービスの更新は、初版では明示的な再ビルドで取り込み、自動pollingを前提にしません。
取得失敗、無効なデータ、重複ページは元の拡張名・入力と関連づけた診断にし、
空ページ一覧や過去のデータへ黙ってfallbackしません。
同じ解決済み入力と設定なら同じ出力になることを検証し、外部サービスの応答が変わる場合の
再現性は入力のsnapshot等を別途用意しない限り保証しません。

## ビルド・診断・互換性

1. プロジェクト設定を読み、文書・プログラムを分類して収集し、参照と公開対象を検証する。
2. 外部拡張を実行してデータを解決し、ページ一覧・ルート表・出力計画を確定する。
3. 衝突と出力先の検証を終えてから、Markdownを文書データへ変換し、必要なプログラム・テンプレート・レイアウトをcompile・実行する。
4. 全ページの生成に成功してからHTML・assetsを公開する。

同じ入力では安定した順序でページを処理し、診断と出力一覧も安定させます。
生成失敗を成功扱いにせず、部分的な新成果物を完成したサイトとして公開しません。
安全な一時出力・公開方法、削除されたページの旧成果物の扱いは実装前に定め、
利用者のファイルや任意のディレクトリを一括削除しない方針とします。
診断はファイル・Markdown本文位置・FrontMatter項目またはfence位置・ルート・処理段階を関連づけ、
CLI・Desktopで同じ内容を返します。停止・再実行は共通エンジン案の契約を共有します。

既存の設定なし単一ページCLIを維持し、サイト生成機能は明示的に有効化します。
文法、compiler ABI、HTMLのエスケープを変更せず、既存文書へ`site`項目を必須にしません。
レイアウト・ルートの宣言がない旧プロジェクトへの暗黙の移行も行いません。

## 開発順と検証範囲

| 段階 | 内容 | 完了の証拠 |
| --- | --- | --- |
| 1 | 既存CLIから共通エンジンを抽出 | 既存CLI testと生成HTML・CSS・ライセンスの一致 |
| 2 | Markdown文書データ、文書/プログラム分類、ページデータ、複数ページ、1段の共通レイアウト、ルート出力 | 下記の受理・拒否・境界test、生成HTMLとURLの検証 |
| 3 | 明示的な外部データ拡張 | 同じページ契約での生成、失敗診断、依存ファイル変更後の再build |
| 4 | 公式サイトへ適用 | ビルド用JavaScript削減の比較、既存HTML・URL・base path・配信動作の回帰検証 |

実装時には最低限、次を検証します。

- FrontMatterもMatraコードもない`.md`の収集、単一ファイル・フォルダー参照、本文と任意メタデータ。
- 文書内のプログラム名付きfenceを実行しないこと、分類の矛盾・不正なプログラム設定を拒否すること。
- 文書フォルダーからのページ・記事一覧生成、参照専用文書の非公開、文書/プログラム間のルート衝突。
- Markdown本文の元位置、相対リンク・画像の解決、raw HTMLの扱い、文書追加・変更・削除後の再生成。
- 2ページで同じレイアウトを使い、各ページのデータが混ざらないこと。
- 共通データ、空本文、複数本文ノード、レイアウトなしの完全文書、特殊文字のエスケープ。
- directory/flat両形式、明示ルート、root、ネストしたルート、base pathとcanonical URL。
- 未知の設定・レイアウト、欠落データ、無効な文書結果、公開名衝突の診断。
- ルート・assets・大小文字・ファイル/ディレクトリ衝突、出力先逸脱、symlinkの拒否。
- 拡張の非同期取得成功・失敗、無効な戻り値、変更監視、停止・連続保存後の再実行。
- 途中失敗時に部分サイトを公開しないこと、ページ削除後の出力、同一入力の出力byte一致。
- CLI・Desktopで成果物と診断が一致し、既存の単一ページ経路が変わらないこと。

文書変更だけではbootstrap検証は不要です。実装でcompilerやABIへ影響が及ぶ場合は
別の仕様変更として扱い、Stage 2/3のbyte equalityを含む既存の検証条件を適用します。

## 将来段階で確定する事項

- 公開APIとしての文書選択・参照、recordの元位置、画像処理拡張。
- canonical URLとorigin、base pathを含むURL公開方法。
- 拡張の登録・戻り値・元位置・依存入力のAPI。
- watch・cancel、Desktop統合、一覧のない旧版出力の移行支援。
