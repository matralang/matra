# API Reference

[English](./04-api-reference.md) | [日本語](./04-api-reference.ja.md)

> [!WARNING]
> この文書はCore v0.8のhistorical API referenceです。現在の`@matra/core` APIは[Core README](../../../packages/core/README.ja.md)を参照してください。

## Table of Contents

- [Core Functions](#core-functions)
- [Types](#types)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)
- [Performance Tips](#performance-tips)

## Core Functions

### parse()

`parse(source)`はMatra sourceをASTへ変換します。v0.8ではHTML renderingに近いHAST-compatibleなnodeを出力していました。

```javascript
import { parse } from "@matra/core"

const ast = parse('p("Hello")')
```

### compile()

`compile(source, options?)`はsourceをparseし、contextを受け取ってHTMLを返すrenderer functionを作ります。

```javascript
import { compile } from "@matra/core"

const render = compile('h1("{{title}}")')
render({ title: "Welcome" })
// <h1>Welcome</h1>
```

### transform()

`transform(ast, context)`はdirectiveやinterpolationを適用してtreeを変換します。HTML出力前にdata-drivenな分岐や反復を解決する段階です。

```javascript
const transformed = transform(ast, { show: true })
```

### with_()

`with_(context)`はcontextを束縛したtemplate helperを作るためのAPIでした。

```javascript
const html = with_({ name: "World" })`p { "Hello, {{name}}" }`
```

### toHTML()

`toHTML(ast)`はHAST-like treeをHTML stringへserializeします。

```javascript
toHTML(parse('p("Hello")'))
// <p>Hello</p>
```

### toJSON()

`toJSON(ast)`はtreeをJSONで確認するためのdebug / interchange用APIです。

```javascript
JSON.stringify(toJSON(parse('p("Hello")')), null, 2)
```

## Types

### MatraSyntaxTree

v0.8のtreeは、element node、text node、property / attributeを持つHTML指向の構造でした。現在のCoreでは`tag`、`props`、`children`を持つdomain-neutralな`MatraAST`が中心です。

### HAST Node

HTML rendererとの互換性のため、v0.8の出力はHASTに近いshapeを採用していました。これにより、HTML ecosystemのtoolingと接続しやすくしていました。

## Error Handling

### Parse Errors

構文が不正な場合、parserはsource locationを含むerrorを返すことがあります。editorやCLIではmessageと位置を表示します。

### Transform Errors

Directive対象のcontextが不正な場合は、transform段階でerrorまたは空出力になることがあります。templateに渡すcontextは事前にshapeを整えてください。

### Runtime Safety

Template内で任意のJavaScriptを実行する設計ではないため、表現力はcontext lookupとdirectiveに制限されていました。helperを使う場合は信頼できるcode側に置きます。

## Advanced Usage

### Custom Context Functions

Contextにfunctionを渡して、値の整形や条件判定を行う使い方が想定されていました。ただし、templateを複雑にしすぎないよう、business logicは呼び出し側へ寄せます。

### Nested Templates

Layout templateとpartial templateを分け、compile済みfunctionを組み合わせることで、大きなpageを構成できます。

### Incremental Rendering

ASTをcacheしてcontextだけ差し替えると、parse costを避けられます。

### Streaming (Future)

Streaming renderはfuture ideaとして扱われており、v0.8の中心機能ではありませんでした。

## Performance Tips

### 1. Pre-compile Templates

同じtemplateを何度もrenderする場合は、requestごとにparseしないでcompile済みfunctionを再利用します。

### 2. Use parse() + transform() for Caching

ASTをcacheし、contextごとにtransformとrenderだけを行う構成にできます。

### 3. Minimize Directive Nesting

複雑な条件や大量のnested loopはtemplate transformationのcostと可読性に影響します。dataを整形してからtemplateへ渡します。

## Next Steps

実際の組み込み方は[Integration Guide](./05-integration.ja.md)、具体例は[Examples](./06-examples.ja.md)を参照してください。
