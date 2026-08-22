import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { extractMarkdownFences, extractMatraMarkdown } from "../dist/index.js"

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

  it("extracts named non-Matra fences for page snippets", () => {
    assert.deepEqual(
      extractMarkdownFences("```page.matra\np {}\n```\n\n```example.ts\nconst value = 1\n```\n"),
      [
        { filename: "page.matra", source: "p {}\n" },
        { filename: "example.ts", source: "const value = 1\n" },
      ],
    )
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
