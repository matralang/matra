import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parse } from "@matra/core"
import {
  browserWorkerSource,
  executeNodejsBlock,
  prepareNodejsBlock,
} from "../dist/browser.js"

describe("Matra browser nodejs adapter", () => {
  it("prepares a nodejs code block without Node runtime capabilities", () => {
    const ast = parse(`nodejs[stdout="json" bind="answer"] \`
return { answer: 42 }
\``)
    assert.deepEqual(prepareNodejsBlock(ast), {
      code: "\nreturn { answer: 42 }\n",
      stdout: "json",
      timeout: 3000,
      bind: "answer",
    })
  })

  it("generates a worker program containing code and disabled network globals", () => {
    const source = browserWorkerSource("return input.value * 2", "json")
    assert.match(source, /return input\.value \* 2/)
    assert.match(source, /self\.fetch = undefined/)
    assert.match(source, /type: "result"/)
  })

  it("rejects execution when Web Workers are unavailable", async () => {
    await assert.rejects(
      executeNodejsBlock(parse("nodejs`return 1`")),
      /Web Worker execution is not available/,
    )
  })

  it("rejects process-oriented props in browser blocks", () => {
    assert.throws(
      () => prepareNodejsBlock(parse('nodejs[cwd="/tmp"]`return 1`')),
      /Unsupported browser nodejs prop: cwd/,
    )
  })
})
