# Integration Guide

[English](./05-integration.md) | [日本語](./05-integration.ja.md)

> [!WARNING]
> この文書はCore v0.8時点のhistorical integration guideです。現在のpackage構成とは異なる場合があります。

## Table of Contents

- [Installation](#installation)
- [Build Tools](#build-tools)
- [Frameworks](#frameworks)
- [Static Site Generators](#static-site-generators)
- [TypeScript](#typescript)
- [Best Practices](#best-practices)

## Installation

```bash
npm install @matra/core
```

v0.8では`@matra/core`がparse、transform、HTML renderまでを担う想定でした。現在はCoreとdomain rendererの責務がより分離されています。

## Build Tools

### Node.js

```javascript
import { compile } from "@matra/core"

const render = compile('main(h1("{{title}}"))')
const html = render({ title: "Home" })
```

### Vite

Viteでは、`.matra` fileを読み込むpluginを用意し、build時にtemplateをcompileする設計が想定されます。

```javascript
export default function matraPlugin() {
  return {
    name: "matra",
    transform(code, id) {
      if (!id.endsWith(".matra")) return null
      return `export default ${JSON.stringify(code)}`
    },
  }
}
```

### Webpack

WebpackではloaderでMatra sourceをJavaScript moduleへ変換します。大きなprojectではcompile済みrendererをexportする形にするとruntime costを減らせます。

### Rollup

Rollup pluginでもViteと同様に`.matra` fileを処理できます。library配布ではtemplate sourceをbundleに含めるか、precompile結果を含めるかを選びます。

## Frameworks

### Express.js

```javascript
app.get("/", (req, res) => {
  const html = renderHome({ title: "Home" })
  res.type("html").send(html)
})
```

### Fastify

```javascript
fastify.get("/", async () => renderHome({ title: "Home" }))
```

### Koa

```javascript
router.get("/", ctx => {
  ctx.type = "html"
  ctx.body = renderHome({ title: "Home" })
})
```

## Static Site Generators

### Custom SSG

MarkdownやJSONを読み込み、pageごとにcontextを作ってMatra templateへ渡します。

```javascript
for (const page of pages) {
  const html = layout({ title: page.title, content: page.html })
  await fs.writeFile(`dist/${page.slug}.html`, html)
}
```

### 11ty (Eleventy)

11tyではcustom template languageとして登録し、Matra sourceをrenderするadapterを用意する構成が考えられます。

## TypeScript

TypeScript projectでは、contextのshapeを型で定義してからrendererに渡すとtemplateとの対応を保ちやすくなります。

```ts
type PageContext = {
  title: string
  items: string[]
}
```

## Best Practices

### 1. Pre-compile Templates

本番環境ではrequestごとにparseしないで、起動時またはbuild時にcompileします。

### 2. Cache Compiled Templates

Template fileのmtimeやhashをkeyにしてcacheすると、development中のreloadとproduction performanceを両立できます。

### 3. Separate Layout and Content

Layout、component、content dataを分けると、templateがconditionとloopだけに集中できます。

### 4. Use Context Helpers

formattingやURL生成はhelperとしてcontextに渡します。ただし重い処理や副作用はtemplate内に置かないでください。

### 5. Handle Errors Gracefully

Parse errorやmissing dataはbuild / request boundaryで捕捉し、source file名とcontextを含めてreportします。

## Next Steps

具体的なtemplate例は[Examples](./06-examples.ja.md)、APIの詳細は[API Reference](./04-api-reference.ja.md)を参照してください。
