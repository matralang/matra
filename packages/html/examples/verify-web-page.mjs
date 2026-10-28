import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { renderWebPage, sourceURL } from "./web-page.mjs"

test("検証用MarkdownからJavaScript連携・Wasm実行を経て完全なHTMLを生成する", async () => {
  const markdown = await readFile(sourceURL, "utf8")
  const html = await renderWebPage(markdown)
  assert.ok(html.startsWith('<!doctype html>\n<html lang="ja">'))
  assert.match(html, /<meta charset="utf-8">/)
  assert.match(html, /<title>Matra &amp; Web<\/title>/)
  assert.match(html, /<link rel="stylesheet" href="\.\/matra.css">/)
  assert.match(html, /<h1>Matra &amp; Web<\/h1>/)
  assert.equal((html.match(/<li>/g) ?? []).length, 3)
  assert.match(html, /読了の目安：8分/)
  assert.match(html, /すべて読む目安：24分/)
  assert.ok(html.endsWith("</html>\n"))
  assert.doesNotMatch(html, /\[object Object\]|undefined/)

  // データの変更がMatra sourceやHTML断片への暗黙の挿入にならないことを確認する。
  const changed = await renderWebPage(markdown.replace("Matra & Web", "<em>Matra</em> & Web"))
  assert.match(changed, /<h1>&lt;em&gt;Matra&lt;\/em&gt; &amp; Web<\/h1>/)
  assert.doesNotMatch(changed, /<em>Matra<\/em>/)
})
