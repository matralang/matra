# Introduction to Matra

[English](./01-introduction.md) | [日本語](./01-introduction.ja.md)

> [!WARNING]
> この文書はHTML指向だったCore v0.8のhistorical documentationです。現在の規範的な仕様は[Matra Specification v0.2](../../README.ja.md)を参照してください。

## What is Matra?

Matraは、HTMLのようなtree structureを短く読みやすいtext syntaxで記述するためのtemplate languageとして設計されました。v0.8時点では、sourceをparseしてHAST-compatibleなASTへ変換し、contextを使ったtemplate transformationを行い、HTMLへrenderする流れを中心にしていました。

```matra
div.container {
  h1 { "Hello, {{name}}" }
  p { "Welcome to Matra." }
}
```

同じ構造はfunction syntaxでも表現できます。

```matra
div({class:"container"},
  h1("Hello, {{name}}"),
  p("Welcome to Matra.")
)
```

## Design Philosophy

### 1. **Familiar Syntax**

Block syntaxはCSS selectorとHTMLの階層構造に近く、function syntaxはJavaScriptやPythonの関数呼び出しに近い読み味を持ちます。どちらもtreeを直接書くことを重視しています。

### 2. **Minimal Learning Curve**

HTML templateを書く人が少ない概念で始められるように、element、attribute、text、directiveを中心に構成していました。複雑なmacro systemやcompile-time magicを前提にしません。

### 3. **Zero Dependencies**

Core packageは小さく保ち、parser、transform、rendererの基本機能だけで動くことを目指していました。現在のMatraでも、domain-neutralなCoreとdomain packageを分ける考え方は引き継がれています。

## Use Cases

### Static Site Generation

MarkdownやJSONなどのdataからHTML pageを生成する用途です。layoutをMatra templateとして定義し、build時にcontextを渡してHTMLへcompileします。

### Component Libraries

小さなUI fragmentをtemplate functionとして管理し、必要なdataを渡してHTMLを生成します。v0.8では`with_(context)` helperがこの用途を支えていました。

### Dynamic HTML Generation

server-side renderingやCLI toolで、runtimeのdataからHTML stringを作る用途です。`m-if`や`m-each`を使うと、conditionやlist renderingをtemplate内に置けます。

## Comparison with Other Template Engines

Matra v0.8は、JSXほどJavaScriptに密結合せず、Handlebarsよりtree構造を明示的に書ける、軽量なtemplate languageを目指していました。HTMLに直接近い構文ではなく、ASTを中心にした中間表現を持つ点が特徴です。

| Engine | 主な特徴 | Matra v0.8との違い |
| --- | --- | --- |
| JSX | JavaScript expressionと密接に統合 | Matraはdata-drivenなtemplateを重視 |
| Handlebars | text templateとhelper中心 | Matraはtree structureを構文で表す |
| Pug | indentation-based HTML shorthand | Matraはblock / function syntaxを併用 |

## Key Features

### Simple Syntax

```matra
article.card {
  h2 { "{{title}}" }
  p { "{{summary}}" }
}
```

### Two Directive Styles

Attribute-based directive:

```matra
p[m-if="visible"] { "Shown" }
```

Tag-based directive:

```matra
m-if[test="visible"] {
  p { "Shown" }
}
```

### Powerful Interpolation

```matra
p { "Hello, {{user.name}}" }
```

Context objectのproperty pathをtext内へ埋め込めます。

### AST-Based

Matra sourceはASTへparseされ、transformとrenderの段階を分けて扱えます。これにより、HTML以外の出力やtoolingへの展開も想定していました。

## Getting Started

```bash
npm install @matra/core
```

```javascript
import { compile } from "@matra/core"

const render = compile('p("Hello, {{name}}")')
console.log(render({ name: "World" }))
// <p>Hello, World</p>
```

現在のプロジェクトで新しく使う場合は、archiveではなく現行の[Core README](../../../packages/core/README.ja.md)と[仕様](../../README.ja.md)を起点にしてください。
