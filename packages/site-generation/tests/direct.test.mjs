import assert from "node:assert/strict"
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { buildSite, generateSite } from "@matra/site-generation"

const card = `fn Card(props, children) {
  article.card { h2 { props.title }; ...children }
}`
const shell = `html {
  head { title { page.data.title } }
  body { header { site.data.label }; main { ...page.content } }
}`
const page = "Card({ title: page.data.title }, [p { page.data.description }])"
const text = (root, path) => readFile(join(root, "dist", path), "utf8")
const literate = (source, data = {}) =>
  `---\nmatra:\n  entry: main.matra\nsite:\n  data: ${JSON.stringify(data)}\n---\n\`\`\`main.matra\n${source}\n\`\`\`\n`

async function project(t) {
  const root = await mkdtemp(join(tmpdir(), "matra-direct-site-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

function options(
  root,
  pages = [
    { kind: "matra", route: "/", source: page, data: { title: "Home", description: "Body" } },
  ],
) {
  return {
    root,
    data: { label: "Shared" },
    defaultLayout: "default",
    layouts: { default: { source: shell } },
    components: { Card: { source: card } },
    pages,
  }
}

test("direct JS page registration reuses components without a config, front matter, or intermediate files", async t => {
  const root = await project(t)
  const products = [
    { slug: "first", title: "<First>", description: "Body & details" },
    { slug: "second", title: "Second", description: "Another body" },
  ]
  const inputs = options(
    root,
    products.map(product => ({
      kind: "matra",
      route: `/products/${product.slug}/`,
      source: page,
      data: product,
    })),
  )
  const outputs = await generateSite(inputs)
  assert.deepEqual(outputs, [
    join(root, "dist", "products", "first", "index.html"),
    join(root, "dist", "products", "second", "index.html"),
  ])
  const first = await text(root, "products/first/index.html")
  const second = await text(root, "products/second/index.html")
  assert.match(first, /<title>&lt;First&gt;<\/title>/)
  assert.match(first, /<article class="card"><h2>&lt;First&gt;<\/h2><p>Body &amp; details<\/p>/)
  assert.match(first, /<header>Shared<\/header>/)
  assert.doesNotMatch(first, /Second/)
  assert.match(second, /<h2>Second<\/h2>/)
  assert.doesNotMatch(second, /First/)
  assert.deepEqual(await readdir(root), ["dist"])
  assert.deepEqual(products[0], { slug: "first", title: "<First>", description: "Body & details" })
  await generateSite(inputs)
  assert.equal(await text(root, "products/first/index.html"), first)
})

test("direct and file inputs produce byte-identical HTML and output manifests", async t => {
  const root = await project(t)
  const fileRoot = join(root, "files")
  const directRoot = join(root, "direct")
  await mkdir(directRoot)
  await Promise.all(
    ["pages", "layouts", "components"].map(path =>
      mkdir(join(fileRoot, path), { recursive: true }),
    ),
  )
  const data = { title: "<Home>", description: "Body" }
  await writeFile(
    join(fileRoot, "matra.site.json"),
    JSON.stringify({
      version: 1,
      site: { defaultLayout: "default", components: "components", data: { label: "Shared" } },
    }),
  )
  await writeFile(join(fileRoot, "layouts/default.matra.md"), literate(shell))
  await writeFile(join(fileRoot, "components/Card.matra"), card)
  await writeFile(join(fileRoot, "pages/index.matra.md"), literate(page, data))
  await writeFile(join(fileRoot, "pages/about.md"), "---\ntitle: About\n---\n# About\n")
  await buildSite(fileRoot)
  await generateSite(
    options(directRoot, [
      { kind: "matra", route: "/", source: page, data },
      { kind: "markdown", route: "/about/", source: "# About\n", data: { title: "About" } },
    ]),
  )
  for (const path of ["index.html", "about/index.html", ".matra-site-manifest.json"]) {
    assert.equal(await text(directRoot, path), await text(fileRoot, path))
  }
})

test("inputs are snapshotted before asynchronous work and each page/render gets independent data", async t => {
  const root = await project(t)
  const inputs = options(root)
  const result = generateSite(inputs)
  inputs.pages[0].data.title = "Changed"
  inputs.pages[0].source = "invalid"
  inputs.pages.push({ kind: "matra", route: "/extra/", source: "invalid" })
  inputs.layouts.default.source = "invalid"
  inputs.components.Card.source = "invalid"
  inputs.data.label = "Changed"
  await result
  const home = await text(root, "index.html")
  assert.match(home, /<h2>Home<\/h2>/)
  assert.match(home, /<header>Shared<\/header>/)
  assert.deepEqual(await readdir(join(root, "dist")), [".matra-site-manifest.json", "index.html"])
})

test("logical Markdown links, assets, reference documents, and basePath use the shared pipeline", async t => {
  const root = await project(t)
  await mkdir(join(root, "public"))
  await mkdir(join(root, "content"))
  await writeFile(join(root, "public/logo.svg"), "<svg/>")
  await writeFile(join(root, "content/draft.md"), "---\ntitle: Draft\n---\n# Draft\n")
  const inputs = options(root, [
    {
      kind: "markdown",
      route: "/",
      document: "pages/home.md",
      source:
        "[About](details.matra?from=home#top)\n\n![Logo](../public/logo.svg)\n\n<script>text</script>",
      data: { title: "Home", site: { retained: true } },
    },
    {
      kind: "matra",
      route: "/company/",
      document: "pages/details.matra",
      source: "p { page.route }",
      data: { title: "Company" },
    },
  ])
  inputs.assets = "public"
  inputs.basePath = "/preview"
  inputs.documents = "content"
  inputs.layouts.default.source = `html {
  head {}
  body {
    ...page.content
    footer {
      ...for (doc in site.documents) { span { doc.id } }
      ...for (doc in site.documents) {
        if (doc.id == "pages/home.md") { p { doc.metadata.site.retained } }
      }
    }
  }
}`
  await generateSite(inputs)
  const home = await text(root, "index.html")
  assert.match(home, /href="\/preview\/company\/\?from=home#top"/)
  assert.match(home, /src="\/preview\/assets\/logo.svg"/)
  assert.match(home, /&lt;script&gt;text&lt;\/script&gt;/)
  assert.match(home, /<span>draft.md<\/span>/)
  assert.match(home, /<span>pages\/home.md<\/span>/)
  assert.match(home, /<p>true<\/p>/)
  assert.equal(await text(root, "assets/logo.svg"), "<svg/>")
  assert.match(await text(root, "company/index.html"), /<p>\/company\/<\/p>/)
  assert.doesNotMatch((await readdir(join(root, "dist"))).join(","), /draft/)
})

test("Markdown never treats front matter or named fences as page controls or executable code", async t => {
  const root = await project(t)
  const source =
    "---\nsite:\n  route: /wrong/\n---\n```main.matra\ninvalid\n```\n```evil.js.part\nthrow new Error('never')\n```\n"
  await generateSite(
    options(root, [{ kind: "markdown", route: "/", source, data: { title: "Explicit" } }]),
  )
  const home = await text(root, "index.html")
  assert.match(home, /<title>Explicit<\/title>/)
  assert.match(home, /invalid/)
  assert.match(home, /throw new Error/)
  assert.deepEqual(await readdir(join(root, "dist")), [".matra-site-manifest.json", "index.html"])
})

test("reference document IDs and physical paths cannot ambiguously overlap registered sources", async t => {
  const root = await project(t)
  await mkdir(join(root, "content", "pages"), { recursive: true })
  await writeFile(join(root, "content/pages/home.md"), "# Reference")
  const inputs = options(root, [
    { kind: "markdown", route: "/", document: "pages/home.md", source: "# Page" },
  ])
  await assert.rejects(generateSite({ ...inputs, documents: "content" }), /Duplicate document ID/)
  await mkdir(join(root, "pages"))
  await writeFile(join(root, "pages/home.md"), "# Existing file")
  await assert.rejects(
    generateSite({ ...inputs, documents: "pages" }),
    /conflicts with a logical document/,
  )
})

test("flat output, explicit no-layout pages, deletion, and empty builds retain unowned files", async t => {
  const root = await project(t)
  const inputs = options(root, [
    { kind: "matra", route: "/", source: page, data: { title: "Home", description: "" } },
    {
      kind: "matra",
      route: "/about/",
      source: "html { head {}; body { p { page.route } } }",
      layout: false,
    },
  ])
  inputs.format = "flat"
  await generateSite(inputs)
  assert.match(await text(root, "about.html"), /<p>\/about<\/p>/)
  await writeFile(join(root, "dist/keep.txt"), "keep")
  inputs.pages = inputs.pages.slice(0, 1)
  await generateSite(inputs)
  assert.deepEqual(await readdir(join(root, "dist")), [
    ".matra-site-manifest.json",
    "index.html",
    "keep.txt",
  ])
  await generateSite({ root, pages: [] })
  assert.deepEqual(await readdir(join(root, "dist")), [".matra-site-manifest.json", "keep.txt"])
})

test("all failures preserve previously published HTML, assets, and manifest", async t => {
  const root = await project(t)
  await mkdir(join(root, "public"))
  await writeFile(join(root, "public/a.txt"), "asset")
  const inputs = { ...options(root), assets: "public" }
  await generateSite(inputs)
  const previous = await text(root, "index.html")
  const manifest = await text(root, ".matra-site-manifest.json")
  const failures = [
    [{ ...inputs, pages: [{ ...inputs.pages[0], source: "p {\n" }] }, /pages\/index\.matra:2:1/],
    [
      { ...inputs, pages: [{ ...inputs.pages[0], source: "p { page.data.missing }" }] },
      /Unknown member: missing/,
    ],
    [
      {
        ...inputs,
        components: { Card: { source: "fn Card(props, children) { Card(props, children) }" } },
      },
      /Card -> Card/,
    ],
    [
      { ...inputs, pages: [{ kind: "matra", route: "/", source: '"text"', layout: false }] },
      /static Matra node output/,
    ],
    [
      { ...inputs, pages: [{ kind: "matra", route: "/", source: "p {}", layout: false }] },
      /one html root/,
    ],
    [
      { ...inputs, pages: [{ kind: "matra", route: "/", source: "html { head {}; body {} }" }] },
      /cannot be placed inside a layout/,
    ],
    [
      { ...inputs, pages: [{ kind: "markdown", route: "/", source: "[Missing](missing.md)" }] },
      /does not resolve/,
    ],
    [
      {
        ...inputs,
        pages: [
          { kind: "matra", route: "/", source: "p {}", document: "pages/a.matra" },
          { kind: "matra", route: "/", source: "p {}", document: "pages/b.matra" },
        ],
      },
      /Duplicate route/,
    ],
  ]
  for (const [invalid, expected] of failures) {
    await assert.rejects(generateSite(invalid), expected)
    assert.equal(await text(root, "index.html"), previous)
    assert.equal(await text(root, ".matra-site-manifest.json"), manifest)
    assert.equal(await text(root, "assets/a.txt"), "asset")
  }
})

test("direct input validation rejects invalid options, sources, registrations, routes, and layouts", async t => {
  const root = await project(t)
  const entry = { kind: "matra", route: "/", source: "html { head {}; body {} }" }
  const invalid = [
    [null, /options must be an object/],
    [[], /options must be an object/],
    [{ root }, /pages must be an array/],
    [{ root, pages: {} }, /pages must be an array/],
    [{ root, pages: [], extra: true }, /Unknown generateSite/],
    [{ root: false, pages: [] }, /root must/],
    [{ root, pages: [null] }, /must be an object/],
    [{ root, pages: [{ ...entry, kind: "unknown" }] }, /kind must/],
    [{ root, pages: [{ ...entry, route: false }] }, /route must/],
    [{ root, pages: [{ ...entry, route: "/../escape" }] }, /invalid site route/],
    [{ root, pages: [{ ...entry, source: {} }] }, /source must/],
    [{ root, pages: [{ ...entry, unknown: true }] }, /Unknown pages/],
    [{ root, pages: [{ ...entry, layout: "missing" }] }, /unknown layout/],
    [{ root, pages: [{ ...entry, layout: 1 }] }, /layout must/],
    [{ root, pages: [], data: [] }, /data must be an object/],
    [{ root, pages: [{ ...entry, data: [] }] }, /data must be an object/],
    [{ root, pages: [], layouts: [] }, /layouts must be an object/],
    [{ root, pages: [], defaultLayout: "missing" }, /unknown layout/],
    [{ root, pages: [], layouts: { "../bad": { source: "" } } }, /Invalid layouts name/],
    [{ root, pages: [], layouts: { shell: "p {}" } }, /must be an object/],
    [{ root, pages: [], layouts: { shell: { source: "", extra: true } } }, /Unknown layouts/],
    [
      { root, pages: [], layouts: { shell: { source: "" }, Shell: { source: "" } } },
      /Duplicate layouts name/,
    ],
    [{ root, pages: [], components: { Other: { source: card } } }, /component name must match/],
    [{ root, pages: [], documents: {} }, /documents must/],
  ]
  for (const [input, expected] of invalid) await assert.rejects(generateSite(input), expected)
  for (const document of [
    "",
    "../escape.matra",
    "/absolute.matra",
    "pages\\bad.matra",
    "pages//bad.matra",
    "pages/./bad.matra",
    "pages/%20.matra",
  ]) {
    await assert.rejects(
      generateSite({ root, pages: [{ ...entry, document }] }),
      /safe project-relative/,
    )
  }
  await assert.rejects(
    generateSite({
      root,
      pages: [
        { ...entry, document: "pages/duplicate.matra" },
        { ...entry, route: "/other", document: "pages/Duplicate.matra" },
      ],
    }),
    /Duplicate logical document/,
  )
})

test("direct data rejects unsupported values without invoking accessors or losing properties", async t => {
  const root = await project(t)
  let accessed = false
  const accessor = {
    get title() {
      accessed = true
      return "not allowed"
    },
  }
  const cyclic = {}
  cyclic.self = cyclic
  for (const data of [
    { value: undefined },
    { value: Infinity },
    { value: () => {} },
    { value: new Date() },
    { value: new Map() },
    cyclic,
    accessor,
    { [Symbol("hidden")]: 1 },
    Object.defineProperty({}, "hidden", { value: 1 }),
    { items: new Array(2) },
    { value: new Proxy({}, {}) },
  ]) {
    await assert.rejects(
      generateSite({ ...options(root), data }),
      /plain data|plain objects|data properties|dense arrays/,
    )
  }
  assert.equal(accessed, false)
})

test("direct generation rejects unsafe filesystem inputs, output collisions, and logical paths", async t => {
  const root = await project(t)
  const inputs = options(root)
  for (const output of [".", "../outside", "/absolute"]) {
    await assert.rejects(
      generateSite({ ...inputs, output }),
      /project root|inside the project|relative path/,
    )
  }
  await assert.rejects(
    generateSite({ ...inputs, pages: [{ ...inputs.pages[0], document: "dist/input.matra" }] }),
    /must not overlap/,
  )
  await assert.rejects(generateSite({ ...inputs, assets: "dist/assets" }), /must not overlap/)
  await assert.rejects(generateSite({ ...inputs, documents: "dist/content" }), /must not overlap/)
  await mkdir(join(root, "actual"))
  await symlink(join(root, "actual"), join(root, "dist"), "dir")
  await assert.rejects(generateSite(inputs), /Unsafe site output path/)
  await rm(join(root, "dist"))
  await symlink(join(root, "actual"), join(root, "linked-assets"), "dir")
  await assert.rejects(generateSite({ ...inputs, assets: "linked-assets" }), /not a symlink/)
  await mkdir(join(root, "public"))
  await writeFile(join(root, "public/file.txt"), "asset")
  await assert.rejects(
    generateSite({
      ...inputs,
      format: "flat",
      assets: "public",
      pages: [{ ...inputs.pages[0], route: "/assets/file.txt/child/" }],
    }),
    /File and directory output collision/,
  )
})
