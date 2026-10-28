---
matra:
  entry: main.matra
  values:
    - datasets/sales.js.part
    - analytics/total.js.part
---

# JavaScriptの値からMatra文書を作る

入口と依存値をFrontMatterに記述し、文書単位で選択して実行する。

```text
pnpm literate -- build crates/matra-seed/examples literate-values.md literate-values.json
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
