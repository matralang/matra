import { randomUUID } from "node:crypto"
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { evaluateStatic, parse, staticValueToAST } from "@matra/core"
import { buildLiterate, runLiterate } from "@matra/core/experimental/literate"
import { toHTML } from "@matra/html"
import { load as loadYaml } from "js-yaml"
import { markdownToNodes } from "./markdown.mjs"

const CONFIG_NAMES = ["matra.site.yaml", "matra.site.json", "matra.site.matra"]
const SITE_KEYS = new Set(["route", "layout", "data"])

export async function renderLiterateDocument(markdown, options = {}) {
  const bundle = await buildLiterate(markdown, { document: options.document })
  const value = await runLiterate(bundle, { globals: options.globals })
  return staticValueToAST(value)
}

export async function buildSite(directory) {
  const root = resolve(directory)
  const config = await readConfig(root)
  const settings = normalizeSettings(config, root)
  for (const input of [
    settings.pagesDirectory,
    ...settings.documentDirectories,
    settings.layoutsDirectory,
    ...(settings.assetsDirectory ? [settings.assetsDirectory] : []),
  ]) {
    if (
      input === settings.outputDirectory ||
      input.startsWith(`${settings.outputDirectory}${sep}`) ||
      settings.outputDirectory.startsWith(`${input}${sep}`)
    ) {
      throw new Error("site.output must not overlap a site input directory")
    }
  }
  await Promise.all([
    assertDirectory(root, settings.pagesDirectory),
    ...settings.documentDirectories.map(path => assertDirectory(root, path)),
    assertDirectory(root, settings.layoutsDirectory, { optional: true }),
    ...(settings.assetsDirectory ? [assertDirectory(root, settings.assetsDirectory)] : []),
  ])
  const documents = await collectDocuments(root, settings)
  const layouts = await collectLayouts(root, settings)
  const pages = await collectPages(root, settings, documents, layouts)
  const assets = settings.assetsDirectory ? await collectAssets(settings.assetsDirectory) : []
  const outputPlan = planOutput(pages, assets, settings)
  settings.routes = new Map(pages.map(page => [page.path, page.route]))
  settings.routesByRoute = new Set(pages.map(page => page.route))
  settings.assetFiles = new Set(assets.map(asset => resolve(asset.source)))
  settings.assetOutputs = new Set(assets.map(asset => `/${asset.output.split(sep).join("/")}`))
  await validateOutput(root, settings.outputDirectory, outputPlan)
  settings.documents = documents.map(document => ({
    id: document.id,
    path: document.id,
    metadata: metadataValues(document.metadata),
    content: markdownToNodes(
      document.body,
      settings.routes.has(document.path)
        ? {
            resolveLink: (href, kind) => resolveMarkdownLink(href, kind, document, settings),
          }
        : {},
    ),
  }))
  for (const layout of layouts.values()) {
    layout.bundle = await buildLiterate(layout.source, { document: layout.document })
  }
  for (const page of pages) {
    if (page.kind === "program") {
      page.bundle = await buildLiterate(page.source, { document: page.document })
    }
  }

  const rendered = []
  for (const page of pages) {
    const content = await renderPage(page, settings)
    const document = page.layout
      ? await renderLayout(layouts.get(page.layout), content, page, settings)
      : content
    assertCompleteDocument(document, page.source)
    rendered.push({
      path: outputPlan.routes.get(page.route),
      content: `<!doctype html>\n${toHTML(document, { basePath: settings.basePath })}\n`,
    })
  }
  for (const asset of assets) rendered.push({ path: asset.output, content: asset.content })
  await publish(root, settings.outputDirectory, rendered)
  return rendered.map(file => join(settings.outputDirectory, file.path))
}

async function readConfig(root) {
  const found = []
  for (const name of CONFIG_NAMES) {
    try {
      const info = await lstat(join(root, name))
      if (!info.isFile()) throw new Error(`Site configuration must be a regular file: ${name}`)
      found.push(name)
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
  }
  if (found.length !== 1) {
    throw new Error(
      found.length
        ? `Use exactly one site configuration file: ${found.join(", ")}`
        : `Missing site configuration. Expected one of: ${CONFIG_NAMES.join(", ")}`,
    )
  }
  const name = found[0]
  const source = await readFile(join(root, name), "utf8")
  let config
  try {
    if (name.endsWith(".json")) config = JSON.parse(source)
    else if (name.endsWith(".matra")) config = evaluateStatic(parse(source))
    else config = loadYaml(source)
  } catch (error) {
    throw new SyntaxError(`${name}: ${error.message}`, { cause: error })
  }
  assertPlainData(config, name)
  if (!isRecord(config)) throw new TypeError(`${name}: configuration must be an object`)
  return config
}

function normalizeSettings(config, root) {
  rejectUnknownKeys(config, new Set(["version", "site"]), "configuration")
  if (config.version !== 1) throw new TypeError("Site configuration must set version: 1")
  if (!isRecord(config.site)) throw new TypeError("Configuration must define a site object")
  rejectUnknownKeys(
    config.site,
    new Set([
      "pages",
      "documents",
      "layouts",
      "defaultLayout",
      "output",
      "format",
      "assets",
      "basePath",
      "data",
    ]),
    "site",
  )
  const site = config.site
  const resolveDirectory = (value, label, fallback) => {
    const name = value === undefined ? fallback : value
    if (typeof name !== "string" || !name || isAbsolute(name) || name.includes("\\")) {
      throw new TypeError(`site.${label} must be a non-empty relative path`)
    }
    const path = resolve(root, name)
    if (path !== root && !path.startsWith(`${root}${sep}`)) {
      throw new TypeError(`site.${label} must stay inside the project directory`)
    }
    return path
  }
  const pagesDirectory = resolveDirectory(site.pages, "pages", "pages")
  const documentsValue = site.documents === undefined ? [] : site.documents
  const documentNames = typeof documentsValue === "string" ? [documentsValue] : documentsValue
  if (!Array.isArray(documentNames)) {
    throw new TypeError("site.documents must be a path or a list of paths")
  }
  const documentDirectories = [
    ...new Set([
      pagesDirectory,
      ...documentNames.map((name, index) => resolveDirectory(name, `documents[${index}]`, name)),
    ]),
  ]
  const layoutsDirectory = resolveDirectory(site.layouts, "layouts", "layouts")
  const outputDirectory = resolveDirectory(site.output, "output", "dist")
  const assetsDirectory =
    site.assets === undefined ? undefined : resolveDirectory(site.assets, "assets", site.assets)
  if (site.format !== undefined && !["directory", "flat"].includes(site.format)) {
    throw new TypeError("site.format must be 'directory' or 'flat'")
  }
  const format = site.format ?? "directory"
  const basePath = normalizeBasePath(site.basePath === undefined ? "" : site.basePath)
  if (site.data !== undefined) assertPlainData(site.data, "site.data")
  if (site.data !== undefined && !isRecord(site.data)) {
    throw new TypeError("site.data must be an object")
  }
  if (
    site.defaultLayout !== undefined &&
    site.defaultLayout !== false &&
    (typeof site.defaultLayout !== "string" || !site.defaultLayout)
  ) {
    throw new TypeError("site.defaultLayout must be a layout name or false")
  }
  return {
    root,
    pagesDirectory,
    documentDirectories,
    layoutsDirectory,
    outputDirectory,
    assetsDirectory,
    defaultLayout: site.defaultLayout === undefined ? false : site.defaultLayout,
    format,
    basePath,
    data: site.data ?? {},
  }
}

async function assertDirectory(root, path, { optional = false } = {}) {
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error(`Input directory escapes project root: ${path}`)
  }
  let current = root
  const parts = relative(root, path).split(sep).filter(Boolean)
  for (const part of parts) {
    current = join(current, part)
    try {
      const info = await lstat(current)
      if (!info.isDirectory())
        throw new Error(`Expected a directory, not a symlink or file: ${current}`)
    } catch (error) {
      if (error.code === "ENOENT" && optional) return false
      throw error
    }
  }
  return true
}

async function walkFiles(directory) {
  const results = []
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"))
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) results.push(path)
      else throw new Error(`Unsupported input file type: ${path}`)
    }
  }
  await visit(directory)
  return results
}

async function collectDocuments(root, settings) {
  const documents = []
  const ids = new Map()
  for (const directory of settings.documentDirectories) {
    await assertDirectory(root, directory)
    for (const path of await walkFiles(directory)) {
      if (!path.endsWith(".md") || path.endsWith(".matra.md")) continue
      const id = relative(directory, path).split(sep).join("/")
      const key = id.toLocaleLowerCase("en-US")
      if (ids.has(key)) {
        if (ids.get(key) !== path) throw new Error(`Duplicate document ID ignoring case: ${id}`)
        continue
      }
      ids.set(key, path)
      const source = await readFile(path, "utf8")
      const parsed = parseFrontMatter(source, path)
      documents.push({
        id,
        path,
        source,
        body: parsed.body,
        metadata: parsed.metadata,
      })
    }
  }
  documents.sort((left, right) => left.id.localeCompare(right.id, "en"))
  return documents
}

async function collectLayouts(root, settings) {
  const layouts = new Map()
  if (!(await assertDirectory(root, settings.layoutsDirectory, { optional: true }))) return layouts
  for (const path of await walkFiles(settings.layoutsDirectory)) {
    if (!path.endsWith(".matra.md")) continue
    const name = relative(settings.layoutsDirectory, path)
      .split(sep)
      .join("/")
      .slice(0, -".matra.md".length)
    if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(name)) {
      throw new Error(`Invalid layout name in ${path}: ${name}`)
    }
    if (layouts.has(name)) throw new Error(`Duplicate layout: ${name}`)
    const source = await readFile(path, "utf8")
    const frontMatter = parseFrontMatter(source, path)
    if (!frontMatter.present) throw new Error(`${path}: layout requires Matra front matter`)
    layouts.set(name, {
      name,
      path,
      source,
      document: relative(root, path).split(sep).join("/"),
    })
  }
  return layouts
}

async function collectPages(root, settings, documents, layouts) {
  const pages = []
  for (const path of await walkFiles(settings.pagesDirectory)) {
    if (path.endsWith(".matra.md")) {
      const source = await readFile(path, "utf8")
      const frontMatter = parseFrontMatter(source, path)
      if (!frontMatter.present) throw new Error(`${path}: program page requires Matra front matter`)
      const controls = siteControls(frontMatter.metadata, path)
      const relativePath = relative(settings.pagesDirectory, path).split(sep).join("/")
      const id = relativePath.slice(0, -".matra.md".length) + ".md"
      const route = normalizeRoute(controls.route ?? routeFromId(id), settings.format, path)
      pages.push({
        kind: "program",
        id,
        path,
        source,
        document: relative(root, path).split(sep).join("/"),
        data: controls.data ?? {},
        route,
        layout: selectedLayout(controls.layout, settings.defaultLayout, layouts, path),
      })
      continue
    }
    if (!path.endsWith(".md")) continue
    const document = documents.find(entry => entry.path === path)
    if (!document) throw new Error(`Page document was not collected: ${path}`)
    const parsed = parseFrontMatter(document.source, path)
    const controls = siteControls(parsed.metadata, path)
    const metadata = metadataValues(parsed.metadata)
    if (controls.data && Object.keys(metadata).length) {
      throw new Error(`${path}: use either site.data or ordinary front matter values, not both`)
    }
    const id = relative(settings.pagesDirectory, path).split(sep).join("/")
    pages.push({
      kind: "markdown",
      id,
      path,
      source: document.source,
      body: parsed.body,
      document,
      data: controls.data ?? metadata,
      route: normalizeRoute(controls.route ?? routeFromId(id), settings.format, path),
      layout: selectedLayout(controls.layout, settings.defaultLayout, layouts, path),
    })
  }
  pages.sort((left, right) => left.route.localeCompare(right.route, "en"))
  const routes = new Set()
  for (const page of pages) {
    const key = page.route.toLocaleLowerCase("en-US")
    if (routes.has(key)) throw new Error(`Duplicate route: ${page.route}`)
    routes.add(key)
  }
  return pages
}

function parseFrontMatter(source, path) {
  const opening = /^(?:\uFEFF)?---[ \t]*\r?\n/.exec(source)
  if (!opening) return { present: false, metadata: {}, body: source }
  const rest = source.slice(opening[0].length)
  const closing = /(?:^|\r?\n)---[ \t]*(?:\r?\n|$)/.exec(rest)
  if (!closing) throw new SyntaxError(`${path}: unclosed YAML front matter`)
  const yaml = rest.slice(0, closing.index)
  let metadata
  try {
    metadata = loadYaml(yaml)
  } catch (error) {
    throw new SyntaxError(`${path}: invalid YAML front matter: ${error.message}`, { cause: error })
  }
  assertPlainData(metadata, `${path} front matter`)
  if (metadata === undefined) metadata = {}
  if (!isRecord(metadata)) throw new TypeError(`${path}: front matter must be an object`)
  const end = closing.index + closing[0].length
  return { present: true, metadata, body: rest.slice(end) }
}

function siteControls(metadata, path) {
  const value = Object.hasOwn(metadata, "site") ? metadata.site : {}
  if (!isRecord(value)) throw new TypeError(`${path}: site front matter must be an object`)
  rejectUnknownKeys(value, SITE_KEYS, `${path} site front matter`)
  if (value.route !== undefined && typeof value.route !== "string") {
    throw new TypeError(`${path}: site.route must be a string`)
  }
  if (
    value.layout !== undefined &&
    value.layout !== false &&
    (typeof value.layout !== "string" || !value.layout)
  ) {
    throw new TypeError(`${path}: site.layout must be a layout name or false`)
  }
  if (value.data !== undefined) {
    assertPlainData(value.data, `${path} site.data`)
    if (!isRecord(value.data)) throw new TypeError(`${path}: site.data must be an object`)
  }
  return value
}

function metadataValues(metadata) {
  const values = { ...metadata }
  delete values.site
  return values
}

function selectedLayout(pageLayout, defaultLayout, layouts, path) {
  const name = pageLayout === false ? false : (pageLayout ?? defaultLayout)
  if (name && !layouts.has(name)) throw new Error(`${path}: unknown layout '${name}'`)
  return name || false
}

function routeFromId(id) {
  const noExtension = id.replace(/\.md$/, "")
  if (noExtension === "index") return "/"
  const route = noExtension.endsWith("/index")
    ? noExtension.slice(0, -"/index".length)
    : noExtension
  return `/${route}/`
}

function normalizeRoute(route, format, path) {
  if (
    !route.startsWith("/") ||
    route.includes("\\") ||
    route.includes("?") ||
    route.includes("#") ||
    route.includes("%")
  ) {
    throw new TypeError(`${path}: invalid site route '${route}'`)
  }
  const parts = route.split("/").slice(1)
  if (parts.at(-1) === "") parts.pop()
  if (parts.some(part => !isSafeSegment(part))) {
    throw new TypeError(`${path}: invalid site route '${route}'`)
  }
  if (parts.length === 0) return "/"
  const normalized = `/${parts.join("/")}`
  return format === "directory" ? `${normalized}/` : normalized
}

function normalizeBasePath(value) {
  if (
    typeof value !== "string" ||
    value.includes("?") ||
    value.includes("#") ||
    value.includes("\\")
  ) {
    throw new TypeError("site.basePath must be a URL path")
  }
  const parts = value.split("/").filter(Boolean)
  if (parts.some(part => part.includes("%") || !isSafeSegment(part))) {
    throw new TypeError("site.basePath contains an invalid path segment")
  }
  return parts.length ? `/${parts.join("/")}` : ""
}

async function renderPage(page, settings) {
  if (page.kind === "markdown") {
    return {
      tag: "$root",
      props: {},
      children: markdownToNodes(page.body, {
        resolveLink: (href, kind) => resolveMarkdownLink(href, kind, page, settings),
      }),
    }
  }
  const value = await runLiterate(page.bundle, {
    globals: globalsFor(page, settings, []),
  })
  return staticValueToAST(value)
}

async function renderLayout(layout, content, page, settings) {
  if (content.tag === "html") {
    throw new TypeError(`${page.source}: a complete HTML document cannot be placed inside a layout`)
  }
  const pageContent = content.tag === "$root" ? content.children : [content]
  const globals = globalsFor(page, settings, pageContent)
  const value = await runLiterate(layout.bundle, { globals })
  return staticValueToAST(value)
}

function globalsFor(page, settings, content) {
  return {
    site: {
      data: settings.data,
      documents: settings.documents,
    },
    page: {
      data: page.data,
      route: page.route,
      content,
    },
  }
}

function resolveMarkdownLink(href, kind, page, settings) {
  if (/^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/.test(href) || href.startsWith("#")) return href
  const [pathname, suffix = ""] = href.split(/(?=[?#])/, 2)
  if (!pathname) return href
  if (pathname.startsWith("/")) {
    const route = normalizeRoute(pathname, settings.format, page.path)
    if (settings.routesByRoute.has(route)) return `${route}${suffix}`
    if (settings.assetOutputs.has(pathname)) return `${pathname}${suffix}`
    throw new Error(`${page.path}: local reference does not resolve: ${href}`)
  }
  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch (error) {
    throw new Error(`${page.path}: invalid encoded local reference: ${href}`, { cause: error })
  }
  const target = resolve(dirname(page.path), decodedPath)
  const assetRoot = settings.assetsDirectory
  if (assetRoot && (target === assetRoot || target.startsWith(`${assetRoot}${sep}`))) {
    if (!settings.assetFiles.has(target)) {
      throw new Error(`${page.path}: local asset does not exist: ${href}`)
    }
    const assetPath = relative(assetRoot, target).split(sep).join("/")
    return `/assets/${assetPath}${suffix}`
  }
  if (extname(target) === ".md" || pathname.endsWith(".matra.md")) {
    const route = settings.routes.get(target)
    if (!route) throw new Error(`${page.path}: local Markdown link does not resolve: ${href}`)
    return `${route}${suffix}`
  }
  if (kind === "image") throw new Error(`${page.path}: local image is not in site.assets: ${href}`)
  throw new Error(`${page.path}: local reference does not resolve: ${href}`)
}

function assertCompleteDocument(ast, source) {
  if (ast.tag !== "html") throw new TypeError(`${source}: generated page must have one html root`)
  const heads = ast.children.filter(
    child => child && typeof child === "object" && child.tag === "head",
  )
  const bodies = ast.children.filter(
    child => child && typeof child === "object" && child.tag === "body",
  )
  if (heads.length !== 1 || bodies.length !== 1 || ast.children.length !== 2) {
    throw new TypeError(`${source}: generated html must contain exactly one head and one body`)
  }
}

async function collectAssets(directory) {
  const assets = []
  for (const source of await walkFiles(directory)) {
    const name = relative(directory, source).split(sep).join("/")
    if (name.split("/").some(part => !isSafeSegment(part))) {
      throw new Error(`Invalid asset path: ${name}`)
    }
    assets.push({
      source,
      output: join("assets", ...name.split("/")),
      content: await readFile(source),
    })
  }
  return assets.sort((left, right) => left.output.localeCompare(right.output, "en"))
}

function planOutput(pages, assets, settings) {
  const routes = new Map()
  const outputs = []
  for (const page of pages) {
    const route = page.route
    const path =
      route === "/"
        ? "index.html"
        : settings.format === "flat"
          ? `${route.slice(1)}.html`
          : join(...route.slice(1, -1).split("/"), "index.html")
    routes.set(route, path)
    outputs.push(path)
  }
  outputs.push(...assets.map(asset => asset.output))
  const seen = new Map()
  for (const output of outputs) {
    const normalized = output.split(sep).join("/").toLocaleLowerCase("en-US")
    if (seen.has(normalized))
      throw new Error(`Output collision: ${output} and ${seen.get(normalized)}`)
    seen.set(normalized, output)
  }
  for (const output of outputs) {
    const parts = output.split(sep)
    for (let index = 1; index < parts.length; index++) {
      const prefix = parts.slice(0, index).join("/").toLocaleLowerCase("en-US")
      if (seen.has(prefix)) {
        throw new Error(`File and directory output collision: ${seen.get(prefix)} and ${output}`)
      }
    }
  }
  return { routes, files: outputs }
}

async function validateOutput(root, outputDirectory, plan) {
  let current = root
  const parts = relative(root, outputDirectory).split(sep).filter(Boolean)
  for (const part of parts) {
    current = join(current, part)
    try {
      const info = await lstat(current)
      if (!info.isDirectory()) throw new Error(`Unsafe site output path: ${current}`)
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
  }
  try {
    await lstat(outputDirectory)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    return
  }
  for (const file of plan.files) await validateOutputFile(outputDirectory, file)
}

async function validateOutputFile(output, relativePath) {
  let current = output
  const parts = relativePath.split(sep)
  for (let index = 0; index < parts.length; index++) {
    current = join(current, parts[index])
    try {
      const info = await lstat(current)
      if (info.isSymbolicLink() || (index < parts.length - 1 && !info.isDirectory())) {
        throw new Error(`Unsafe site output path: ${current}`)
      }
      if (index === parts.length - 1 && !info.isFile()) {
        throw new Error(`Expected a regular output file: ${current}`)
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error
      break
    }
  }
}

async function publish(root, outputDirectory, rendered) {
  const parent = dirname(outputDirectory)
  await ensureDirectoryPath(root, parent)
  await validateOutput(root, outputDirectory, { files: rendered.map(file => file.path) })
  const stage = await mkdtemp(join(parent, `.${basename(outputDirectory)}-stage-`))
  const backup = join(parent, `.${basename(outputDirectory)}-backup-${randomUUID()}`)
  try {
    let existingOutput
    try {
      existingOutput = await lstat(outputDirectory)
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
    if (existingOutput) {
      if (!existingOutput.isDirectory())
        throw new Error(`Unsafe site output path: ${outputDirectory}`)
      await validateTree(outputDirectory)
      await cp(outputDirectory, stage, { recursive: true, force: true })
    }
    for (const file of rendered) {
      const stagedPath = join(stage, file.path)
      await mkdir(dirname(stagedPath), { recursive: true })
      await writeFile(stagedPath, file.content)
    }
    let hadOutput = false
    try {
      await rename(outputDirectory, backup)
      hadOutput = true
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
    try {
      await rename(stage, outputDirectory)
    } catch (error) {
      if (hadOutput) await rename(backup, outputDirectory)
      throw error
    }
    if (hadOutput) await rm(backup, { recursive: true, force: true })
  } finally {
    await rm(stage, { recursive: true, force: true })
  }
}

async function ensureDirectoryPath(root, path) {
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error(`Site output parent escapes project root: ${path}`)
  }
  let current = root
  for (const part of relative(root, path).split(sep).filter(Boolean)) {
    current = join(current, part)
    try {
      const info = await lstat(current)
      if (!info.isDirectory()) throw new Error(`Unsafe site output path: ${current}`)
    } catch (error) {
      if (error.code !== "ENOENT") throw error
      await mkdir(current)
    }
  }
}

async function validateTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await validateTree(path)
    else if (!entry.isFile()) throw new Error(`Unsafe site output entry: ${path}`)
  }
}

function rejectUnknownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`Unknown ${label} setting: ${key}`)
  }
}

function assertPlainData(value, label, active = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return
  if (typeof value === "number" && Number.isFinite(value)) return
  if (typeof value !== "object" || active.has(value)) {
    throw new TypeError(`${label} must contain only finite plain data`)
  }
  if (!Array.isArray(value) && !isRecord(value)) {
    throw new TypeError(`${label} must contain only plain objects and arrays`)
  }
  active.add(value)
  for (const item of Array.isArray(value) ? value : Object.values(value)) {
    assertPlainData(item, label, active)
  }
  active.delete(value)
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  )
}

function isSafeSegment(value) {
  return (
    value !== "" &&
    value !== "." &&
    value !== ".." &&
    !/[<>:"|?*]/.test(value) &&
    ![...value].some(character => character.charCodeAt(0) < 0x20) &&
    !/[. ]$/.test(value) &&
    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(value)
  )
}
