# @matra/styles

`@matra/styles` は、Matra が出力するセマンティック HTML 向けの小さな No-Class CSS です。
見出し、本文、リスト、ナビゲーション、表、フォームなどをクラスなしで整えます。

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@matra/styles@0.1.0/matra.css">
```

必要な場合だけ、`.matra-callout`、`.matra-stack`、`.matra-cluster`、`.matra-frame`、`.matra-button`、`.matra-nav` を利用できます。

Playground では `matra` を選ぶと同じスタイルが適用されます。Markdown の front matter で `matra.stylesheet` を指定すると、`water.css`、`simple.css`、`pico.css`、または HTTPS の CSS URL を文書単位で選べます。
