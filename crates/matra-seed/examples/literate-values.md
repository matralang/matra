# JavaScriptの値からMatra文書を作る

入口と依存値を明示して実行する。

```text
pnpm literate -- build crates/matra-seed/examples literate-values.md main.matra literate-values.json --value datasets/sales.js.part --value analytics/total.js.part
pnpm literate -- run crates/matra-seed/examples literate-values.json
```

```main.matra
article {
  h1 { "Sales" }
  p { analytics.total(datasets.sales) }
  ul {
    ...for (row in datasets.sales) {
      li { row.label; row.amount }
    }
  }
}
```

```datasets/sales.js.part
[
  { label: "A", amount: 10 },
  { label: "B", amount: 20 },
  { label: "C", amount: 30 }
]
```

```analytics/total.js.part
rows => rows.reduce((sum, row) => sum + row.amount, 0)
```

この説明用ブロックは選択されないので実行しない。

```unused.js.part
(() => { throw new Error("Do not execute explanatory code") })()
```
