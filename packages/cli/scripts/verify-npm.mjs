import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { runLauncher } from "./distribution-platform.mjs"

const [cliArchive, stylesArchive, commandArchive, coreArchive, siteGenerationArchive] = process.argv
  .slice(2)
  .map(path => (path ? resolve(path) : undefined))
if (
  !cliArchive ||
  !stylesArchive ||
  !commandArchive ||
  !coreArchive ||
  !siteGenerationArchive ||
  !process.env.npm_execpath
) {
  throw new Error("Run via npm with CLI, Styles, Command, Core, and Site Generation tarball paths")
}
const npm = process.env.npm_execpath
const work = await mkdtemp(join(tmpdir(), "matra-npm-"))
const prefix = join(work, "prefix")

function run(command, args, cwd = work) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${command}: ${result.stderr}`)
  return result.stdout
}

function launch(args, cwd = work) {
  const home = process.platform === "win32" ? prefix : join(prefix, "bin")
  return runLauncher(home, args, { cwd, env: process.env, encoding: "utf8" })
}

function expectFailure(args, cwd, message) {
  const result = spawnSync(process.execPath, [join(modules, "@matra/cli/src/cli.mjs"), ...args], {
    cwd,
    encoding: "utf8",
  })
  if (result.error) throw result.error
  assert.equal(result.status, 1, result.stderr)
  assert.equal(result.stdout, "")
  assert.match(result.stderr, message)
}

const modules = join(prefix, process.platform === "win32" ? "node_modules" : "lib/node_modules")

async function resolvedEntry(specifier, entry) {
  const resolved = run(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
    ],
    dirname(join(modules, "@matra", entry)),
  ).trim()
  return realpath(fileURLToPath(resolved))
}

try {
  run(process.execPath, [
    npm,
    "install",
    "--global",
    "--prefix",
    prefix,
    "--no-audit",
    "--no-fund",
    cliArchive,
    stylesArchive,
    commandArchive,
    coreArchive,
    siteGenerationArchive,
  ])
  const cli = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
  const core = JSON.parse(
    await readFile(new URL("../../core/package.json", import.meta.url), "utf8"),
  )
  const generator = JSON.parse(
    await readFile(new URL("../../site-generation/package.json", import.meta.url), "utf8"),
  )
  const html = JSON.parse(
    await readFile(new URL("../../html/package.json", import.meta.url), "utf8"),
  )
  const installed = {}
  for (const [name, version] of [
    ["cli", cli.version],
    ["core", core.version],
    ["site-generation", generator.version],
    ["command", "0.1.0"],
    ["styles", "0.1.0"],
  ]) {
    installed[name] = JSON.parse(
      await readFile(join(modules, "@matra", name, "package.json"), "utf8"),
    )
    assert.equal(installed[name].version, version)
  }
  assert.equal(installed.cli.dependencies["@matra/core"], core.version)
  assert.equal(installed.cli.dependencies["@matra/site-generation"], generator.version)
  assert.equal(installed.cli.dependencies["@matra/html"], html.version)
  assert.equal(installed.cli.dependencies["@matra/command"], installed.command.version)
  assert.equal(installed.cli.dependencies["@matra/styles"], installed.styles.version)
  assert.equal(installed["site-generation"].dependencies["@matra/core"], `^${core.version}`)
  assert.equal(installed["site-generation"].dependencies["@matra/html"], `^${html.version}`)
  const coreEntry = await realpath(join(modules, "@matra/core/dist/index.js"))
  for (const entry of [
    "cli/src/cli.mjs",
    "site-generation/src/index.mjs",
    "command/dist/index.js",
  ]) {
    assert.equal(await resolvedEntry("@matra/core", entry), coreEntry)
  }
  for (const entry of ["cli/src/cli.mjs", "site-generation/src/index.mjs"]) {
    const htmlEntry = await resolvedEntry("@matra/html", entry)
    const installedHtml = JSON.parse(
      await readFile(resolve(dirname(htmlEntry), "../package.json"), "utf8"),
    )
    assert.equal(installedHtml.version, html.version)
  }
  assert.equal(launch(["--version"]).trim(), cli.version)
  launch(["init", "hello"])
  const project = join(work, "hello")
  launch(["build"], project)
  assert.match(launch(["install"], project), /No dependencies declared/)
  assert.match(await readFile(join(project, "dist/index.html"), "utf8"), /Hello, Matra!/)
  assert.ok((await readFile(join(project, "dist/matra.css"))).length > 0)
  assert.ok((await readFile(join(project, "dist/matra.css.LICENSE"))).length > 0)

  const site = join(work, "site")
  await Promise.all(
    ["pages", "layouts", "components"].map(path => mkdir(join(site, path), { recursive: true })),
  )
  await writeFile(
    join(site, "matra.site.json"),
    JSON.stringify({
      version: 1,
      site: {
        pages: "pages",
        layouts: "layouts",
        components: "components",
        defaultLayout: "default",
        basePath: "/preview",
      },
    }),
  )
  await writeFile(
    join(site, "layouts", "default.matra.md"),
    `---
matra:
  entry: main.matra
---
\`\`\`main.matra
html { head {}; body { Frame({ title: "Layout" }, page.content) } }
\`\`\`
`,
  )
  const cardPath = join(site, "components", "Card.matra")
  await writeFile(
    cardPath,
    'fn Card(props, children) { article.card { h2 { props.title }; a(href="/guide/") { "Guide" }; ...children } }',
  )
  await writeFile(
    join(site, "components", "Frame.matra"),
    "fn Frame(props, children) { main { Card(props, children) } }",
  )
  await writeFile(join(site, "pages", "index.md"), "# Packed site\n")
  await writeFile(
    join(site, "pages", "about.matra.md"),
    `---
matra:
  entry: main.matra
site:
  data:
    title: "<Packed component>"
---
\`\`\`main.matra
Card({ title: page.data.title }, [p { "<Body>" }])
\`\`\`
`,
  )
  const installOutput = launch(["site", "install", "--yes"], site).replaceAll("\\", "/")
  assert.match(installOutput, /pages\/about\.matra\.md/)
  assert.doesNotMatch(installOutput, /components\/|Card\.matra|Frame\.matra/)
  launch(["site", "build"], site)
  const home = await readFile(join(site, "dist/index.html"), "utf8")
  const about = await readFile(join(site, "dist/about/index.html"), "utf8")
  const manifest = await readFile(join(site, "dist/.matra-site-manifest.json"), "utf8")
  assert.match(home, /<h1>Packed site<\/h1>/)
  assert.match(home, /<article class="card"><h2>Layout<\/h2>/)
  assert.match(about, /<h2>&lt;Packed component&gt;<\/h2>/)
  assert.match(about, /<p>&lt;Body&gt;<\/p>/)
  assert.match(about, /href="\/preview\/guide\/"/)
  assert.doesNotMatch(about, /&amp;lt;/)
  assert.equal((about.match(/<article class="card">/g) ?? []).length, 2)
  await writeFile(cardPath, "fn Card(props, children) { Card(props, children) }")
  expectFailure(["site", "build"], site, /Card -> Card/)
  assert.equal(await readFile(join(site, "dist/index.html"), "utf8"), home)
  assert.equal(await readFile(join(site, "dist/about/index.html"), "utf8"), about)
  assert.equal(await readFile(join(site, "dist/.matra-site-manifest.json"), "utf8"), manifest)

  const direct = join(work, "direct")
  await mkdir(direct)
  const generatorURL = pathToFileURL(join(modules, "@matra/site-generation/src/index.mjs")).href
  await writeFile(
    join(work, "verify-direct.mjs"),
    `
import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { generateSite } from ${JSON.stringify(generatorURL)}
const root = ${JSON.stringify(direct)}
const products = [
  { slug: "first", title: "<Direct>", body: "Body & details" },
  { slug: "second", title: "Second", body: "Another body" },
]
const options = {
  root,
  defaultLayout: "default",
  layouts: { default: { source: "html { head {}; body { ...page.content } }" } },
  components: { Card: { source: "fn Card(props, children) { article { h2 { props.title }; ...children } }" } },
  pages: products.map(product => ({
    kind: "matra", route: "/" + product.slug + "/", data: product,
    source: 'Card({ title: page.data.title }, [p { page.data.body }])',
  })),
}
await generateSite(options)
const first = await readFile(root + "/dist/first/index.html", "utf8")
assert.ok(first.includes("<h2>&lt;Direct&gt;</h2>"))
assert.ok(first.includes("<p>Body &amp; details</p>"))
assert.ok((await readFile(root + "/dist/second/index.html", "utf8")).includes("<h2>Second</h2>"))
assert.deepEqual(await readdir(root), ["dist"])
const manifest = await readFile(root + "/dist/.matra-site-manifest.json", "utf8")
options.pages[0].source = "invalid {"
await assert.rejects(generateSite(options))
assert.equal(await readFile(root + "/dist/first/index.html", "utf8"), first)
assert.equal(await readFile(root + "/dist/.matra-site-manifest.json", "utf8"), manifest)
`,
  )
  run(process.execPath, [join(work, "verify-direct.mjs")])

  const listener = createServer()
  listener.listen(0, "127.0.0.1")
  await once(listener, "listening")
  const port = listener.address().port
  await new Promise((resolve, reject) =>
    listener.close(error => (error ? reject(error) : resolve())),
  )
  const child = spawn(
    process.execPath,
    [join(modules, "@matra/cli/src/cli.mjs"), "dev", "--port", String(port)],
    { cwd: project, stdio: ["ignore", "pipe", "pipe"] },
  )
  let output = ""
  child.stdout.on("data", chunk => {
    output += chunk
  })
  child.stderr.on("data", chunk => {
    output += chunk
  })
  try {
    const deadline = Date.now() + 15000
    let response
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`dev exited early: ${output}`)
      if (output.includes("Serving:")) {
        response = await fetch(`http://127.0.0.1:${port}/`)
        break
      }
      await new Promise(done => setTimeout(done, 100))
    }
    assert.ok(response, `dev did not start: ${output}`)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /Hello, Matra!/)
  } finally {
    if (child.exitCode === null) {
      child.kill()
      await once(child, "exit")
    }
  }
  console.log(
    "Packed npm CLI passed dependency resolution, version, init, install, build, components, direct page registration, failure preservation, and dev checks.",
  )
} finally {
  await rm(work, { recursive: true, force: true })
}
