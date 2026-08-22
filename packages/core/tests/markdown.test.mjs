import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { extractMatraMarkdown } from "../dist/index.js"

describe("Markdown Matra fences", () => {
  it("extracts a native Matra fence", () => {
    assert.deepEqual(
      extractMatraMarkdown("# Example\n\n```page.matra\np { \"Hello\" }\n```\n"),
      { filename: "page.matra", kind: "matra", source: "p { \"Hello\" }\n" },
    )
  })

  it("supports long fences and selects a named entry", () => {
    const markdown = [
      "````page.matra",
      "pre { code~```example.matra~ }",
      "````",
      "",
      "```program.matra.ts",
      "matra { p { \"Generated\" } }",
      "```",
    ].join("\n")

    assert.deepEqual(extractMatraMarkdown(markdown, { entry: "program.matra.ts" }), {
      filename: "program.matra.ts",
      kind: "matra.ts",
      source: "matra { p { \"Generated\" } }\n",
    })
  })

  it("rejects missing, ambiguous, and unknown entries", () => {
    assert.throws(() => extractMatraMarkdown("# No source"), /must contain one/)
    assert.throws(
      () => extractMatraMarkdown("```one.matra\np {}\n```\n```two.matra\np {}\n```"),
      /Set an entry/,
    )
    assert.throws(
      () => extractMatraMarkdown("```one.matra\np {}\n```", { entry: "two.matra" }),
      /was not found/,
    )
  })
})
