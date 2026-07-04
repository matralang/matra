# Matra Command

[English](./README.md) | [日本語](./README.ja.md)

`@matra/command` turns Matra `command(...)` nodes into explicit, inspectable
execution plans. Parsing and planning are side-effect free. A local process is
started only after the plan has passed an explicit capability policy and the
caller invokes `executePlan()`.

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

// Display or audit `plan` before granting authority.
const authorized = authorizePlan(plan, {
  commands: ["python"],
  read: ["./data"],
  write: ["./out"],
  network: false,
})

const result = await executePlan(authorized)
```

## Node.js code blocks

For small integration code, `nodejs` is a managed convenience adapter. The
block receives parsed standard input as `input`; either return a value or call
`emit(value)`. Async code and `await` are supported.

```matra
nodejs[stdout="json" bind="answer"] `
return { answer: 6 * 7 }
`
```

Use the alternative `~...~` delimiter when JavaScript template literals need
backticks. Browser applications can import `@matra/command/browser` and call
`executeNodejsBlock()`. Browser blocks run in a disposable Web Worker; Node
APIs and arbitrary terminal commands are unavailable. This is not an OS
security sandbox, so only execute code the user has chosen to run.

## Protocol v0.1

The standard node is `command` with no children and these props:

| Prop | Type | Default |
| --- | --- | --- |
| `program` | non-empty string | required |
| `args` | string array | `[]` |
| `cwd` | string | process default |
| `env` | string map | `{}` |
| `stdin` | JSON-compatible value or `{ref: "binding"}` | none |
| `stdout` | `text`, `json`, `ndjson`, or `binary` | `text` |
| `stderr` | `text` or `ignore` | `text` |
| `timeout` | non-negative milliseconds | none |
| `allowFail` | boolean | `false` |
| `id` | string | generated |
| `bind` | string | none; also becomes the default id |
| `requires` | id/binding string array | `[]` |
| `produces` | path string array | `[]` |
| `capabilities` | `{commands, read, write, network}` | inferred/minimal |

`program` and `args` are passed directly to `child_process.spawn()` with
`shell: false`. Shell parsing, interpolation, and implicit command execution
are intentionally absent. File declarations are authorization metadata; the
runtime does not claim to sandbox the child process by itself. For a hard
sandbox, supply a restricted process adapter or run Matra inside an OS/container
sandbox.

Commands are topologically ordered by `requires`. A failed command produces a
structured result, and dependent commands are marked `skipped`. JSON and NDJSON
outputs are validated as JSON-compatible Matra values.
