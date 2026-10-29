import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { renderWebPage, sourceURL } from "./web-page.mjs"

const expectedHTMLSha256 = "26206c023dbefc9467ff51a1698e58b96705bd242ebbf244ac5141217fbc9f5b"

test("検証用MarkdownからJavaScript連携・Wasm実行を経て完全なHTMLを生成する", async () => {
  const markdown = await readFile(sourceURL, "utf8")
  const html = await renderWebPage(markdown)
  const generatedHTML = await readFile(new URL("./dist/index.html", import.meta.url), "utf8")
  assert.equal(generatedHTML, html)
  assert.equal(createHash("sha256").update(html).digest("hex"), expectedHTMLSha256)
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
