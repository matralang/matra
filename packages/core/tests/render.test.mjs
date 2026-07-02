// render.test.mjs — Matra v0.5 mixed-format integration test
// -----------------------------------------------------------

import { renderHTML } from "../dist/render.js"
import assert from "node:assert"
import { describe, it } from "node:test"

describe("Matra v0.5 Mixed Rendering", () => {
  it("renders Markdown, JSON, and Matra mixed input", () => {
    const src = `
# Mixed Rendering Test

div {
  p { "Matra block within Markdown." }
}

{ key: 42, message: "Hello JSON" }

![alt text](example.png)
`

    const html = renderHTML(src)

    // 表示確認
    console.log(
      "\\n=== Rendered HTML ===\\n" + html + "\\n======================\\n"
    )

    // 主要タグが存在するか確認
    assert.match(html, /<h1>Mixed Rendering Test<\/h1>/)
    assert.match(html, /<p>Matra block within Markdown\.<\/p>/)
    assert.match(html, /&quot;message&quot;:&quot;Hello JSON&quot;/)
    assert.match(html, /<img src="example\.png"/)
  })
})
