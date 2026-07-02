# Matra Core

[English](./README.md) | [日本語](./README.ja.md)

Matra Coreは、HTML、Math、Docs、Graphicsの各パッケージで共有する、小さくドメイン非依存な基盤です。ツリー表現、相互変換、走査、変換、交換可能なParserとRendererの境界を定義します。ドメイン固有の評価処理と出力規則はCoreの外に配置します。

ドメインパッケージは小さな`MatraRenderer`契約を実装し、`renderWith(renderer, ast, options)`で一貫して呼び出せます。Coreは境界だけを所有し、SVGやHTMLなどの出力規則は各パッケージに残します。

## 2つのツリー表現

Parserが生成し、交換形式として使用するMatraJSONは、コンパクトな3要素配列です。

```ts
["tag", { role: "example" }, ["text", ["child", {}, []]]]
```

CoreのVisitor、Transformer、Rendererが使用するASTはオブジェクト形式です。

```ts
{
  tag: "tag",
  props: { role: "example" },
  children: ["text", { tag: "child", props: {}, children: [] }]
}
```

境界では明示的に変換します。

```ts
import { astToMatraJSON, matraJSONToAST } from "@matra/core"
```

## 交換可能なParser

Parserは`parse(source, options?)`メソッドを実装し、ASTまたはMatraJSONを返します。`parseWith()`は、どちらの出力もASTへ正規化します。

```ts
import { parseWith } from "@matra/core"

const ast = parseWith(peggyParser, source)
```

同梱しているPeggy実装はMatraJSONを生成します。Coreの公開`parse()`はその出力をASTへ変換するため、Parserを交換可能な状態に保てます。

## HTML

HTMLレンダリングは、独立したworkspaceパッケージから提供します。

```ts
import { parse } from "@matra/core"
import { toHTML } from "@matralang/matra-html"

toHTML(parse('p("Hello", class="lead")'))
```

関数形式の構文では、propsをPython風のキーワード引数で記述します。

```matra
circle(x=10, y=20, r=5)
```

通常の位置引数はchildrenになります。従来の`circle({x: 10, y: 20, r: 5})`形式も互換性のため利用できますが、標準記法ではありません。

## ドキュメントの言語

英語文書は`name.md`、対応する日本語文書は`name.ja.md`とします。変更を同期しやすくするため、見出し構造とコード例は両言語で揃えます。
