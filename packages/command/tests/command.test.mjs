import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parse } from "@matra/core"
import {
  authorizePlan,
  CommandAuthorizationError,
  CommandValidationError,
  executePlan,
  planCommands,
} from "../dist/index.js"

describe("Matra command planning", () => {
  it("validates command nodes and builds a dependency-ordered plan", () => {
    const ast = parse(`workflow(
      command(
        program="consumer",
        args=["--json"],
        stdin={ref: "producer-output"},
        stdout="json",
        bind="consumer-output",
        requires=["producer-output"],
        capabilities={read: ["./data"], network: false}
      ),
      command(
        program="producer",
        stdout="json",
        bind="producer-output",
        capabilities={write: ["./out"]}
      )
    )`)

    const plan = planCommands(ast)
    assert.deepEqual(plan.commands.map(command => command.id), [
      "producer-output",
      "consumer-output",
    ])
    assert.deepEqual(plan.capabilities, {
      commands: ["producer", "consumer"],
      read: ["./data"],
      write: ["./out"],
      network: false,
    })
  })

  it("rejects malformed commands, missing dependencies, and cycles", () => {
    assert.throws(
      () => planCommands(parse("command(program=python, args=[1])")),
      CommandValidationError,
    )
    assert.throws(
      () => planCommands(parse('command(program="a", requires=["missing"])')),
      /Unknown dependency/,
    )
    assert.throws(
      () => planCommands(parse('command(program="a", timeot=100)')),
      /Unknown command prop: timeot/,
    )
    assert.throws(
      () => planCommands(parse('command(program="a", capabilities={netwrok: true})')),
      /Unknown command capability: netwrok/,
    )
    assert.throws(
      () => planCommands(parse(`workflow(
        command(program="a", id="a", requires=["b"]),
        command(program="b", id="b", requires=["a"])
      )`)),
      /dependency cycle/,
    )
  })
})

describe("Matra command authorization", () => {
  it("authorizes exact commands and paths below allowed roots", () => {
    const plan = planCommands(parse(`command(
      program="python",
      capabilities={read: ["./data/input.json"], write: ["./out/result.json"]}
    )`))
    const authorized = authorizePlan(plan, {
      commands: ["python"],
      read: ["./data"],
      write: ["./out"],
      network: false,
    })
    assert.equal(authorized.authorization.authorized, true)
  })

  it("reports every denied capability", () => {
    const plan = planCommands(parse(`command(
      program="python",
      capabilities={read: ["./private"], network: true}
    )`))
    assert.throws(
      () => authorizePlan(plan, { commands: ["node"], read: ["./data"], network: false }),
      error => {
        assert.ok(error instanceof CommandAuthorizationError)
        assert.equal(error.violations.length, 3)
        return true
      },
    )
  })
})

describe("Matra local process execution", () => {
  it("executes an authorized shell-free plan and binds structured output", async () => {
    const producer = {
      tag: "command",
      props: {
        program: process.execPath,
        args: ["-e", 'process.stdout.write(JSON.stringify({answer: 42}))'],
        stdout: "json",
        bind: "answer",
      },
      children: [],
    }
    const consumer = {
      tag: "command",
      props: {
        program: process.execPath,
        args: ["-e", 'process.stdin.pipe(process.stdout)'],
        stdin: { ref: "answer" },
        stdout: "json",
        bind: "copied",
        requires: ["answer"],
      },
      children: [],
    }
    const plan = planCommands({ tag: "workflow", props: {}, children: [consumer, producer] })
    const authorized = authorizePlan(plan, { commands: [process.execPath] })
    const result = await executePlan(authorized)

    assert.equal(result.status, "ok")
    assert.deepEqual(result.bindings.answer, { answer: 42 })
    assert.deepEqual(result.bindings.copied, { answer: 42 })
    assert.deepEqual(result.results.map(item => item.status), ["ok", "ok"])
  })

  it("returns structured failure and skips dependent commands", async () => {
    const plan = planCommands({
      tag: "workflow",
      props: {},
      children: [
        {
          tag: "command",
          props: {
            program: process.execPath,
            args: ["-e", "process.exit(7)"],
            id: "failure",
          },
          children: [],
        },
        {
          tag: "command",
          props: {
            program: process.execPath,
            args: ["-e", "process.stdout.write('never')"],
            id: "dependent",
            requires: ["failure"],
          },
          children: [],
        },
      ],
    })
    const result = await executePlan(authorizePlan(plan, { commands: [process.execPath] }))
    assert.equal(result.status, "error")
    assert.equal(result.results[0].exitCode, 7)
    assert.equal(result.results[1].status, "skipped")
  })
})
