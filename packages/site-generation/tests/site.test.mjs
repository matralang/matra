import assert from "node:assert/strict"
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
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

test("removes deleted pages and assets while preserving unrelated files", async t => {
  const root = await project(t)
  const config = join(root, "matra.site.yaml")
  await writeFile(config, `${await readFile(config, "utf8")}  assets: public\n`)
  await mkdir(join(root, "public"))
  await writeFile(join(root, "public", "old.txt"), "asset")
  await writeFile(join(root, "pages", "index.md"), "---\ntitle: Home\n---\n# Home")
  await writeFile(join(root, "pages", "old.md"), "---\ntitle: Old\n---\n# Old")
  await buildSite(root)
  await writeFile(join(root, "dist", "old", "keep.txt"), "keep")
  await writeFile(join(root, "dist", "legacy.html"), "untracked")
  await rm(join(root, "pages", "old.md"))
  await rm(join(root, "public", "old.txt"))
  await buildSite(root)

  await assert.rejects(lstat(join(root, "dist", "old", "index.html")), { code: "ENOENT" })
  await assert.rejects(lstat(join(root, "dist", "assets")), { code: "ENOENT" })
  assert.equal(await readFile(join(root, "dist", "old", "keep.txt"), "utf8"), "keep")
  assert.equal(await readFile(join(root, "dist", "legacy.html"), "utf8"), "untracked")
  const manifest = JSON.parse(
    await readFile(join(root, "dist", ".matra-site-manifest.json"), "utf8"),
  )
  assert.deepEqual(manifest, { version: 1, files: ["index.html"] })
  await rm(join(root, "pages", "index.md"))
  assert.deepEqual(await buildSite(root), [])
  await assert.rejects(lstat(join(root, "dist", "index.html")), { code: "ENOENT" })
})

test("removes old routes and handles directory/flat output transitions", async t => {
  const root = await project(t)
  const page = join(root, "pages", "about.md")
  await writeFile(page, "---\ntitle: About\n---\n# About")
  await buildSite(root)
  await writeFile(page, "---\ntitle: About\nsite:\n  route: /company/\n---\n# About")
  await buildSite(root)
  await assert.rejects(lstat(join(root, "dist", "about")), { code: "ENOENT" })
  const config = join(root, "matra.site.yaml")
  const source = await readFile(config, "utf8")
  await writeFile(config, `${source}  format: flat\n`)
  await buildSite(root)
  await assert.rejects(lstat(join(root, "dist", "company")), { code: "ENOENT" })
  assert.match(await readFile(join(root, "dist", "company.html"), "utf8"), /<h1>About<\/h1>/)
  await writeFile(config, source)
  await buildSite(root)
  await assert.rejects(lstat(join(root, "dist", "company.html")), { code: "ENOENT" })
  assert.match(
    await readFile(join(root, "dist", "company", "index.html"), "utf8"),
    /<h1>About<\/h1>/,
  )
})

test("a failed rebuild preserves deleted-page outputs and the previous manifest", async t => {
  const root = await project(t)
  await writeFile(join(root, "pages", "index.md"), "---\ntitle: Home\n---\n# Home")
  await writeFile(join(root, "pages", "old.md"), "---\ntitle: Old\n---\n# Old")
  await buildSite(root)
  const manifestPath = join(root, "dist", ".matra-site-manifest.json")
  const manifest = await readFile(manifestPath, "utf8")
  const old = await readFile(join(root, "dist", "old", "index.html"), "utf8")
  await rm(join(root, "pages", "old.md"))
  await writeFile(join(root, "pages", "index.md"), "# Missing layout data")
  await assert.rejects(buildSite(root), /Unknown member: title/)
  assert.equal(await readFile(manifestPath, "utf8"), manifest)
  assert.equal(await readFile(join(root, "dist", "old", "index.html"), "utf8"), old)
})

test("rejects invalid output manifests without deleting any files", async t => {
  const root = await project(t)
  await writeFile(join(root, "pages", "index.md"), "---\ntitle: Home\n---\n# Home")
  await buildSite(root)
  const path = join(root, "dist", ".matra-site-manifest.json")
  const home = await readFile(join(root, "dist", "index.html"), "utf8")
  await writeFile(join(root, "keep.txt"), "outside")
  for (const source of [
    "{",
    JSON.stringify({ version: 2, files: [] }),
    JSON.stringify({ version: 1, files: ["../keep.txt"] }),
    JSON.stringify({ version: 1, files: ["/keep.txt"] }),
    JSON.stringify({ version: 1, files: ["a\\b"] }),
    JSON.stringify({ version: 1, files: [".matra-site-manifest.json"] }),
    JSON.stringify({ version: 1, files: ["index.html", "INDEX.html"] }),
  ]) {
    await writeFile(path, source)
    await assert.rejects(buildSite(root), /site output manifest/)
    assert.equal(await readFile(path, "utf8"), source)
    assert.equal(await readFile(join(root, "dist", "index.html"), "utf8"), home)
    assert.equal(await readFile(join(root, "keep.txt"), "utf8"), "outside")
  }
})

test("does not infer ownership of old output when a manifest is absent", async t => {
  const root = await project(t)
  await mkdir(join(root, "dist"))
  await writeFile(join(root, "dist", "old.html"), "legacy")
  await writeFile(join(root, "pages", "index.md"), "---\ntitle: Home\n---\n# Home")
  await buildSite(root)
  assert.equal(await readFile(join(root, "dist", "old.html"), "utf8"), "legacy")
  await rm(join(root, "pages", "index.md"))
  await buildSite(root)
  assert.equal(await readFile(join(root, "dist", "old.html"), "utf8"), "legacy")
})

test("prunes generated file/directory conflicts but never removes an untracked blocker", async t => {
  const root = await project(t)
  const config = join(root, "matra.site.yaml")
  await writeFile(config, `${await readFile(config, "utf8")}  format: flat\n`)
  const page = join(root, "pages", "page.md")
  await writeFile(page, "---\ntitle: Page\nsite:\n  route: /company/\n---\n# Page")
  await buildSite(root)
  await writeFile(page, "---\ntitle: Page\nsite:\n  route: /company.html/team/\n---\n# Team")
  await buildSite(root)
  assert.match(await readFile(join(root, "dist", "company.html", "team.html"), "utf8"), /Team/)
  await writeFile(page, "---\ntitle: Page\nsite:\n  route: /company/\n---\n# Page")
  await buildSite(root)
  assert.match(await readFile(join(root, "dist", "company.html"), "utf8"), /Page/)
  await mkdir(join(root, "dist", "blocked.html"))
  await writeFile(join(root, "dist", "blocked.html", "keep.txt"), "keep")
  const manifestPath = join(root, "dist", ".matra-site-manifest.json")
  const manifest = await readFile(manifestPath, "utf8")
  await writeFile(page, "---\ntitle: Page\nsite:\n  route: /blocked/\n---\n# Page")
  await assert.rejects(buildSite(root), /Expected a regular output file/)
  assert.equal(await readFile(manifestPath, "utf8"), manifest)
  assert.match(await readFile(join(root, "dist", "company.html"), "utf8"), /Page/)
  assert.equal(await readFile(join(root, "dist", "blocked.html", "keep.txt"), "utf8"), "keep")
})

test("rejects reserved manifest routes and symlinks in tracked stale output", async t => {
  const root = await project(t)
  const page = join(root, "pages", "index.md")
  await writeFile(
    page,
    "---\ntitle: Home\nsite:\n  route: /.matra-site-manifest.json/\n---\n# Home",
  )
  await assert.rejects(buildSite(root), /Reserved site output path/)
  if (process.platform === "win32") return
  await writeFile(page, "---\ntitle: Home\n---\n# Home")
  await buildSite(root)
  await writeFile(join(root, "keep.txt"), "outside")
  await rm(join(root, "dist", "index.html"))
  await symlink(join(root, "keep.txt"), join(root, "dist", "index.html"))
  await rm(page)
  await assert.rejects(buildSite(root), /Unsafe site output entry/)
  assert.equal(await readFile(join(root, "keep.txt"), "utf8"), "outside")
})
