import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { buildSite } from "../src/site.mjs"

const layout = `---
matra:
  entry: main.matra
---
\`\`\`main.matra
html(lang="en") {
  head { title { page.data.title } }
  body {
    header { site.data.label }
    main { ...page.content }
    footer {
      ...for (document in site.documents) {
        span { document.id }
      }
    }
  }
}
\`\`\`
`

async function project(t) {
  const root = await mkdtemp(join(tmpdir(), "matra-site-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  await Promise.all([
    mkdir(join(root, "pages"), { recursive: true }),
    mkdir(join(root, "content"), { recursive: true }),
    mkdir(join(root, "layouts"), { recursive: true }),
  ])
  await writeFile(join(root, "layouts", "default.matra.md"), layout)
  await writeFile(
    join(root, "matra.site.yaml"),
    `version: 1
site:
  pages: pages
  documents: content
  layouts: layouts
  defaultLayout: default
  data:
    label: Shared
`,
  )
  return root
}

test("builds Markdown and Matra pages with isolated data and a shared layout", async t => {
  const root = await project(t)
  await writeFile(
    join(root, "pages", "index.md"),
    `---
title: "<Home>"
---
# Hello

This is **Markdown**.

\`\`\`example.matra
not executed
\`\`\`
`,
  )
  await writeFile(
    join(root, "pages", "about.matra.md"),
    `---
matra:
  entry: main.matra
site:
  data:
    title: About
---
\`\`\`main.matra
article { h1 { page.data.title }; p { site.data.label } }
\`\`\`
`,
  )
  await writeFile(join(root, "content", "draft.md"), "# Draft")

  const outputs = await buildSite(root)

  assert.equal(outputs.length, 2)
  const home = await readFile(join(root, "dist", "index.html"), "utf8")
  const about = await readFile(join(root, "dist", "about", "index.html"), "utf8")
  assert.match(home, /<title>&lt;Home&gt;<\/title>/)
  assert.match(home, /<h1>Hello<\/h1>/)
  assert.match(home, /<strong>Markdown<\/strong>/)
  assert.match(home, /not executed/)
  assert.match(home, /<header>Shared<\/header>/)
  assert.match(home, /<span>draft\.md<\/span>/)
  assert.match(about, /<h1>About<\/h1>/)
  assert.match(about, /<p>Shared<\/p>/)
  assert.doesNotMatch(about, /Hello/)
  assert.equal(
    await readFile(join(root, "dist", "draft", "index.html"), "utf8").catch(() => ""),
    "",
  )
})

test("supports JSON and static Matra configuration files", async t => {
  for (const [filename, source] of [
    [
      "matra.site.json",
      JSON.stringify({
        version: 1,
        site: {
          pages: "pages",
          layouts: "layouts",
          defaultLayout: "default",
          data: { label: "JSON" },
        },
      }),
    ],
    [
      "matra.site.matra",
      '({ version: 1, site: { pages: "pages", layouts: "layouts", defaultLayout: "default", data: { label: "Matra" } } })',
    ],
  ]) {
    const root = await project(t)
    await rm(join(root, "matra.site.yaml"))
    await writeFile(join(root, filename), source)
    await writeFile(join(root, "pages", "index.md"), `---\ntitle: Config\n---\n# Config`)
    await buildSite(root)
    assert.match(
      await readFile(join(root, "dist", "index.html"), "utf8"),
      new RegExp(`<header>${filename.endsWith(".json") ? "JSON" : "Matra"}</header>`),
    )
  }
})

test("supports flat routes, explicit route overrides, and index pages", async t => {
  const root = await project(t)
  await writeFile(
    join(root, "matra.site.yaml"),
    `version: 1
site:
  pages: pages
  layouts: layouts
  defaultLayout: default
  format: flat
  data:
    label: Shared
`,
  )
  await writeFile(join(root, "pages", "index.md"), `---\ntitle: Home\n---\n# Home`)
  await mkdir(join(root, "pages", "blog"), { recursive: true })
  await writeFile(join(root, "pages", "blog", "index.md"), `---\ntitle: Blog\n---\n# Blog`)
  await writeFile(
    join(root, "pages", "about.md"),
    `---
title: About
site:
  route: /company/
---
# About
`,
  )

  const outputs = await buildSite(root)

  assert.deepEqual(outputs.map(path => path.replace(`${root}/dist/`, "")).sort(), [
    "blog.html",
    "company.html",
    "index.html",
  ])
  assert.match(await readFile(join(root, "dist", "company.html"), "utf8"), /<h1>About<\/h1>/)
})

test("reports route collisions and leaves existing output untouched on generation failure", async t => {
  const root = await project(t)
  await writeFile(join(root, "pages", "index.md"), `---\ntitle: First\n---\n# First`)
  await buildSite(root)
  await writeFile(join(root, "dist", "keep.txt"), "keep")
  await writeFile(join(root, "pages", "index.md"), `---\ntitle: Second\n---\n# Second`)
  await buildSite(root)
  const previous = await readFile(join(root, "dist", "index.html"), "utf8")
  assert.match(previous, /Second/)
  assert.equal(await readFile(join(root, "dist", "keep.txt"), "utf8"), "keep")
  await writeFile(
    join(root, "pages", "index.md"),
    `---
title: Changed
site:
  route: /about/
---
# Changed
`,
  )
  await writeFile(join(root, "pages", "about.md"), "# Duplicate")
  await assert.rejects(buildSite(root), /Duplicate route/)
  assert.equal(await readFile(join(root, "dist", "index.html"), "utf8"), previous)
  assert.equal(await readFile(join(root, "dist", "keep.txt"), "utf8"), "keep")
})

test("a later page runtime failure does not publish an earlier rendered page", async t => {
  const root = await project(t)
  await writeFile(join(root, "pages", "index.md"), `---\ntitle: Home\n---\n# Home`)
  const programPath = join(root, "pages", "about.matra.md")
  const validProgram = `---
matra:
  entry: main.matra
site:
  data:
    title: About
---
\`\`\`main.matra
article { h1 { page.data.title } }
\`\`\`
`
  await writeFile(programPath, validProgram)
  await buildSite(root)
  const previousHome = await readFile(join(root, "dist", "index.html"), "utf8")
  const previousAbout = await readFile(join(root, "dist", "about", "index.html"), "utf8")
  await writeFile(programPath, validProgram.replace("page.data.title", "page.data.missing.value"))

  await assert.rejects(buildSite(root), /Unknown member: missing/)

  assert.equal(await readFile(join(root, "dist", "index.html"), "utf8"), previousHome)
  assert.equal(await readFile(join(root, "dist", "about", "index.html"), "utf8"), previousAbout)
})

test("rewrites local page and asset links and applies the configured base path", async t => {
  const root = await project(t)
  await mkdir(join(root, "public"), { recursive: true })
  await writeFile(join(root, "public", "logo.svg"), "<svg/>")
  await writeFile(
    join(root, "matra.site.yaml"),
    `version: 1
site:
  pages: pages
  layouts: layouts
  defaultLayout: default
  assets: public
  basePath: /preview
  data:
    label: Shared
`,
  )
  await writeFile(
    join(root, "pages", "index.md"),
    `---
title: Home
---
[About](about.matra.md)

![Logo](../public/logo.svg)

<script>shown as text</script>
`,
  )
  await writeFile(
    join(root, "pages", "about.matra.md"),
    `---
matra:
  entry: main.matra
site:
  data:
    title: About
---
\`\`\`main.matra
article { h1 { page.data.title } }
\`\`\`
`,
  )
  await buildSite(root)
  const home = await readFile(join(root, "dist", "index.html"), "utf8")
  assert.match(home, /href="\/preview\/about\/"/)
  assert.match(home, /src="\/preview\/assets\/logo\.svg"/)
  assert.match(home, /&lt;script&gt;shown as text&lt;\/script&gt;/)
  assert.equal(await readFile(join(root, "dist", "assets", "logo.svg"), "utf8"), "<svg/>")
})

test("rejects output symlinks", { skip: process.platform === "win32" }, async t => {
  const root = await project(t)
  const outside = await mkdtemp(join(tmpdir(), "matra-site-outside-"))
  t.after(() => rm(outside, { recursive: true, force: true }))
  await writeFile(join(root, "pages", "index.md"), "# Page")
  await symlink(outside, join(root, "dist"), "dir")
  await assert.rejects(buildSite(root), /Unsafe site output path/)
})
