# Matra Command

[English](./README.md) | [日本語](./README.ja.md)

`@matra/command`はMatraの`command(...)` nodeを、明示的で検査可能な実行計画へ
変換します。parseとplanningには副作用がありません。local processを開始するのは、
計画が明示的なcapability policyを通過し、呼び出し側が`executePlan()`を実行した場合だけです。

```matra
command(
  program="python",
  args=["scripts/solve.py", "--format", "json"],
  stdin={problem: 42},
  stdout="json",
  bind="solution",
  timeout=30000,
  capabilities={
    read: ["./data"],
    write: ["./out"],
    network: false
  }
)
```

```ts
import { parse } from "@matra/core"
import { authorizePlan, executePlan, planCommands } from "@matra/command"

const plan = planCommands(parse(source, { locations: true }))

// authorityを与える前にplanを表示・監査できます。
const authorized = authorizePlan(plan, {
  commands: ["python"],
  read: ["./data"],
  write: ["./out"],
  network: false,
})

const result = await executePlan(authorized)
```

## Node.js code block

小さな連携コードには、managed convenience adapterの`nodejs`を利用できます。
標準入力をparseした値は`input`へ渡されます。値を`return`するか`emit(value)`を
呼び出してください。async codeと`await`も利用できます。

```matra
nodejs[stdout="json" bind="answer"] `
return { answer: 6 * 7 }
`
```

JavaScript template literalでbacktickが必要な場合は`~...~` delimiterを使えます。
browserでは`@matra/command/browser`の`executeNodejsBlock()`を利用します。使い捨て
Web Worker内で動作し、Node APIや任意のterminal commandは利用できません。これは
OS security sandboxではないため、ユーザーが実行を選んだcodeだけを対象にしてください。

標準nodeはchildrenを持たない`command`です。`program`、`args`、`cwd`、`env`、
`stdin`、`stdout`、`stderr`、`timeout`、`allowFail`、`id`、`bind`、`requires`、
`produces`、`capabilities`をpropsとして受け取ります。

`program`と`args`は`child_process.spawn()`へ直接渡し、`shell: false`で実行します。
shellのparse、interpolation、暗黙的なcommand実行は行いません。

read/write宣言は認可用metadataであり、それ自体がchild processをOS levelで
sandbox化するわけではありません。強制的な隔離が必要な場合は、制限付きadapterまたは
OS/container sandbox内でMatraを実行してください。

commandは`requires`に従ってtopological orderへ並び替えます。失敗結果は構造化して返し、
依存commandを`skipped`にします。JSON/NDJSON出力はJSON互換Matra valueとして検証します。
