# Declarative site generation using Matra (additional design proposal)

[English](./site-generation.md) | [日本語](./site-generation.ja.md) | [Index](./README.md)

## Status and scope

This additional proposal supplements the
[shared build engine proposal](./desktop-app.md).
The Stage 1–2 MVP is implemented. External data extensions, watching, and migration of the official website
remain future work. The MVP input contract and configuration examples in this document are implemented.
It is not a prerequisite for the first Desktop version.

The target is site generation using Matra, not changes to Matra Program or compiler source grammar.
The parser, AST/data model, compiler ABI, and existing Core/HTML behavior remain unchanged.
`runLiterate()` provides an additive `globals` option that clones and validates plain data.
This proposal does not override the [grammar](./grammar.md) or
[initial literate contract](./literate-modules.md).

## MVP implementation contract

Site generation uses `matra site install` and `matra site build`, separate from the existing single-page
`matra build`. The install command prepares dependencies for configured executable pages and layouts.
The shared engine package is `@matra/site-generation`. Place exactly one of these configuration files in the project root:

- `matra.site.yaml`: YAML
- `matra.site.json`: JSON
- `matra.site.matra`: a static Matra object expression (for example, `({ version: 1, site: { pages: "pages" } })`)

All formats use the same versioned schema. Unknown settings, dynamic Matra configuration, and input/output paths outside
the project root are rejected.

```yaml
version: 1
site:
  pages: pages
  documents: content
  layouts: layouts
  defaultLayout: default
  output: dist
  format: directory
  assets: public
  basePath: /preview
  data:
    title: My site
```

Ordinary `.md` files under `site.pages` are published Markdown pages and do not require FrontMatter.
Executable pages and layouts use the `.matra.md` extension and a literate `matra.entry`.
`site.documents` is an additional document root (one path or a list); collected documents are not published automatically.
The `site` FrontMatter object on pages/layouts accepts only `route`, `layout`, and `data`.
When `site.data` is present, combining it with ordinary FrontMatter fields is rejected.

Layouts receive `site.data`, `site.documents`, `page.data`, `page.route`, and `page.content`.
`page.content` is a document-node sequence, not an HTML string.
The literate runtime validates and clones injected values as plain data and reports collisions with selected `.js.part`
public names.
Markdown conversion uses markdown-it's default settings with HTML, linkification, and typography disabled.
Tables and strikethrough are supported; raw HTML is not executed as nodes and is escaped as text.

With directory output, `pages/index.md` maps to `/`, `pages/about.md` to `/about/`,
and `pages/blog/post.md` to `/blog/post/`. With `flat` output, trailing slashes are removed and these pages
are written as `index.html`, `about.html`, and `blog/post.html`.
Regular files under `site.assets` are copied under output `assets/`; input symlinks, collisions, and missing local
references are rejected. `basePath` prefixes root-relative `href` and `src` values during HTML rendering.

The engine renders and validates every page before publication, copies the previous output to a staging directory,
applies generated files, then swaps directories. The reserved output file `.matra-site-manifest.json`
records generated HTML and assets as `{ "version": 1, "files": [...] }`, using sorted relative paths with `/` separators.
The manifest itself is not included in the return value of `buildSite()`.
On the next successful build, only previously listed files absent from the new output are removed in staging.
This covers page/asset deletion, route changes, and directory/flat transitions; only empty ancestor directories are removed.
Unlisted existing files are preserved. Generated files belong to the engine; manual edits do not make them protected.
Legacy output without a manifest is preserved without guessing ownership; inspect and clean legacy files when first migrating.
Do not manually edit the reserved manifest or use its path for route output.
Invalid JSON, unsupported versions, duplicate or escaping paths, symlinks, and unexpected file types are diagnosed,
not ignored by silently discarding the manifest. Generation, validation, or publication failure preserves the previous
output and manifest. External extensions, watching, canonical URL generation, Desktop integration,
and migration of the official website are not included.

## Reusable Matra components

Set `site.components` to a component directory to register its `.matra` files.
Omitting it disables component collection. The directory must exist and follows the same project-root,
no-symlink, and no-output-overlap checks as other inputs.
Components are neither published pages nor literate documents; they need no FrontMatter or fences.
They are not dependency-install targets for `matra site install`.

```yaml
version: 1
site:
  components: components
  defaultLayout: default
```

Each component file defines exactly one top-level `fn` with two parameters.
The function name, not the filename, is its public name. Names differing only in case are duplicates
across the entire directory. For example, `components/Card.matra`:

```matra
fn Card(props, children) {
  article.card {
    h2 { props.title }
    ...children
  }
}
```

Executable pages and layouts use ordinary function calls:

```matra
main {
  Card({ title: page.data.title }, [
    p { "Body" }
  ])
}
```

- Both arguments are required: a plain props object and a children array.
  Pass `[]` for no children. Parameter names are not prescribed.
- Components return one document node. Strings, arrays, null, and other results are diagnosed.
  Children are cloned as values, not rendered HTML; escaping and `basePath` apply at final HTML output.
- Components may call other registered components. Direct and indirect cycles are diagnosed with the call chain.
- Each call gets an isolated scope and cloned props/children. Caller variables, `page`, `site`, and
  JavaScript/Python value modules are not implicitly available. Pass required data explicitly in props.
  Helper functions and variables may be defined inside the component function.
- Public names conflicting with page/layout value modules or host globals are diagnosed.
  Local declarations in the same scope follow existing duplicate-binding rules.
- Syntax, definition, and runtime errors identify the original component file. Runtime errors also include
  the calling document and component call chain.
  Component failures preserve the previous output and manifest without publishing partial output.

This is a compatible site-generation extension, not a change to Matra Program/compiler source grammar,
AST/data model, or compiler ABI. Component calls using `Card(title="...") { ... }` or `<Card>`,
Shadow DOM, browser state management, and direct JavaScript page registration are out of scope.

## Purpose

Generate ordinary sites from declarations, with code extensions only for use-specific external processing.
In addition to HTML templates, provide per-page data, shared layouts, and route-based HTML output,
reducing site-specific build JavaScript and custom placeholders.
Adding filesystem operations or CMS integration to the language itself is not a goal.
Treat ordinary Markdown as document data living in folders with ordinary filenames,
like Nuxt Content's `.md` documents, without requiring program settings or code for every article.

## Responsibilities and existing implementation

| Layer | Responsibility |
| --- | --- |
| Matra language | Construct values, functions, and document nodes |
| HTML output | Render document ASTs with HTML escaping |
| Shared build engine | Collect documents/pages, convert standard Markdown to document data, validate settings, pass data, apply layouts, determine routes and outputs, handle assets, diagnostics, and watching |
| External extensions | Use-specific processing such as CMS retrieval, additional Markdown syntax/conversions, and image processing |
| CLI/Desktop | Call the shared engine and present operations, progress, and results |

The current CLI's [`buildProject`](../packages/cli/src/project.mjs) compiles and runs a single
`index.md` via the literate API, then writes HTML, CSS, and its license.
The [official website in its separate repository](https://github.com/matralang/website) collects pages, interprets metadata,
determines output paths, and inserts shared elements, providing concrete examples of site-specific boilerplate.
Website-specific advertising, analytics, and redirects do not become engine defaults.

## Markdown documents as data

### Separate documents from programs

Ordinary `.md` files collected for site generation are non-executable document data by default.
Accept them without FrontMatter, `matra.entry`, `matra.values`, `site`, or Matra fences.
Code-example fences are displayed content, not automatically executed even when named `.matra` or `.js.part`.
Do not infer program classification from body or fence contents.

Place explicit identification requirements on executable programs and templates.
Candidates include registered program directories, a program-specific FrontMatter field,
or a compound extension such as `.matra.md`; settle exact syntax and precedence before implementation.
If existing `matra.entry` is used for identification, document it as a reserved site-generation field.
Files explicitly classified as documents do not interpret literate-like settings as execution instructions.
Conflicting explicit classifications and invalid program settings produce diagnostics, not a fallback to document mode.

This classification is an input contract for the new site-generation feature.
It does not change the existing CLI's `index.md` behavior or the FrontMatter requirement when explicitly calling `buildLiterate()`.
Nuxt Content is a usability reference, not a claim of compatibility with its APIs or extended syntax.

### Collection and references by folder and filename

For example, adding an article should require only files like these:

```text
content/
  about.md
  blog/
    first-post.md
```

`content/blog/first-post.md` is ordinary Markdown without program settings:

```markdown
# First article

Read this document as data and display it with a Matra template.
```

Use the path relative to the document root, such as `blog/first-post.md`, as the document ID.
Allow declarative selection and references to a single file or a sequence of documents under a folder in that root.
Do not require listing article bodies in configuration or writing a JavaScript import for each article.
Collect folders in stable document-ID order; missing references and case-only ID collisions produce diagnostics.
Selection/reference syntax and the public Matra API remain undecided.

Represent document data as records containing document IDs, relative paths, optional FrontMatter metadata,
body node sequences, and source locations; absent FrontMatter means empty metadata.
Keep metadata separate from engine identity fields so arbitrary fields such as `title` cannot overwrite document IDs.
Validate metadata as plain data and retain body-node source locations separately as diagnostic information.
Settle the exact record schema and defaults, such as whether headings supply titles, before implementation.

### From document data to pages

Separate collecting documents from publishing HTML pages. Reference-only Markdown is not automatically published.
A project-level declaration of a published document folder and shared template/layout should generate pages
with routes derived from file placement, without per-document programs or FrontMatter.
Also support passing a single document as page data and building article indexes from document sequences.
Optional FrontMatter supplies metadata but is not a prerequisite for page generation.

Site generation provides standard Markdown-to-document-node conversion.
Pass bodies to Matra templates/layouts through the same composition path as program-generated bodies.
Do not require HTML-string placeholders or a custom parser for each article.
Do not pass raw HTML through as executable HTML by default;
settle its handling and the supported Markdown dialect before implementation.
Additional syntax/conversions use explicit extensions, without making ordinary code examples executable.

Resolve relative document links and images against the source file's directory.
Map links to published documents through the route table and images through the asset output plan.
References outside the root and missing local references produce diagnostics.
Watch document additions, changes, and deletions, regenerating dependent pages and indexes.

## Declarative pages and layouts

### Project and page settings

Project settings specify document/program inputs and classification, published documents and shared templates,
a page input directory, documents for named layouts, shared site data,
assets, output style, and deployment base path and origin.
Use ordinary folders and documents, with the CLI and Desktop reading the same settings.
The configuration filename, schema, and versioning remain open before implementation.

For pages explicitly classified as programs, the engine interprets a `site` field in FrontMatter,
separately from literate `matra` settings.
The following program-page example is not required for Markdown document data.
Read YAML consistently with the existing loader, not with custom line splitting or string replacement.
The first site-generation version diagnoses unknown `site` fields, invalid types, and unknown layouts.

```yaml
---
matra:
  entry: main.matra
site:
  route: /about/
  layout: default
  data:
    title: About this site
    description: A site built with Matra
---
```

When omitted, `route` is derived from file placement and `layout` uses the project default.
Pages returning a complete HTML document can explicitly opt out of layouts;
the syntax for opting out remains undecided.
Omitted `data` means an empty object; missing required data is not replaced with empty strings.

### Runtime data

Proposed public values supplied by the engine:

| Public value | Contents |
| --- | --- |
| `site.data` | Shared project data |
| `page.data` | Page-specific data |
| `page.route` | Logical route without the deployment base path |
| `page.content` | Page body document-node sequence, supplied only during layout execution |

Shared and page data have separate names, without implicit deep merging or overwriting.
Extension-generated pages use the same page description format;
duplicate definitions from FrontMatter and extensions are collisions.
Validate and copy values according to literate's plain-data subset, without sharing mutable execution
state between pages or between body and layout runs.
Collisions between public root names and document bindings or selected values produce diagnostics.

Current `runLiterate()` has no public contract for this external data injection.
Design an explicit host API, rather than generating `.js.part` source from data or manipulating private runtime internals.
Preserve the meanings of existing `matra.entry` and `matra.values`.

### Compose document nodes

A program page's `main.matra` returns only its body.
For document-derived pages, Markdown conversion and a shared template perform this body-generation stage.

```matra
article {
  h1 { page.data.title }
  p { page.data.description }
}
```

A separate literate document corresponding to the named layout `default` also has an explicit entry.
Its Matra entry receives the body as a node sequence.

```matra
html(lang="en") {
  head {
    title { page.data.title }
    meta(name="description" content=page.data.description) {}
  }
  body {
    header { a(href="/") { "My site" } }
    main { ...page.content }
    footer { "Built with Matra" }
  }
}
```

Execution order is: generate page body, validate its document-node sequence, execute layout,
validate the complete document, then render HTML.
The first version supports one layout level, without inheritance or arbitrary hook chains.
Do not turn the body into HTML and reparse it or insert it as raw HTML or a placeholder.
Escape ordinary strings during HTML rendering, performed only once after composition.
The result after layout application (or without a layout) is a complete document with a single
`html` and its `head` and `body`; the engine adds the doctype.
Returning a complete HTML document as a body and wrapping it again produces a diagnostic.

## Proposed route and output contract

Manage logical routes, output files, and public URLs as separate values.
For published documents under `pages/`, the default directory style maps as follows.

| Input | Logical route | Output |
| --- | --- | --- |
| `pages/index.md` | `/` | `dist/index.html` |
| `pages/about.md` | `/about/` | `dist/about/index.html` |
| `pages/blog/entry.md` | `/blog/entry/` | `dist/blog/entry/index.html` |

An explicit `route` overrides only route derivation.
If a compound program extension is adopted, remove its suffix before applying the same route rules.
Register document-derived and program pages in one route table and diagnose collisions between them.
Also allow migration to preserve the official site's current flat style (`/about` with `about.html`).
Choose the style per project, without implicitly mixing styles.
Do not automatically change existing URLs; verify trailing-slash redirects and hosting URL resolution during migration.

- Routes are logical paths starting with `/`. Reject queries, fragments, backslashes,
  `.`/`..`, and empty components except the root. Define percent-encoding and Unicode normalization before implementation.
- Normalize trailing slashes according to output style. Detect duplicate normalized routes,
  duplicate outputs, case-only collisions, and file/directory conflicts, including assets.
- Verify that converting a route to an output path stays inside the output directory.
  Reject symlinks and unexpected file types at the output and its ancestors, without weakening current CLI checks.
- Derive internal links and canonical URLs from the same route table.
  Apply the deployment base path exactly once, preserving external URLs, queries, and fragments.
  Generate canonical URLs when an origin is configured; define their exposure to layouts during API design.

## External extensions

The first extension point only prepares page lists and data.
Retrieve records from a CMS or similar source and return descriptions containing routes,
page templates, data, dependency inputs, and source locations.
The engine owns compilation, layouts, HTML rendering, and output.
Automatic npm resolution and general hooks that modify engine internals are outside the first version.

Complete asynchronous work in the engine before passing resolved plain data to Matra.
Do not add Promises, passing Matra functions to JavaScript, or filesystem/network capabilities to the language.
Extensions are explicitly registered trusted code running in the build process, not an OS sandbox.

Include reported dependency files in watching.
The first version incorporates external service updates on explicit rebuild, without requiring automatic polling.
Retrieval failures, invalid data, and duplicate pages produce diagnostics associated with the original extension and input;
do not silently fall back to empty page lists or old data.
Verify identical output for identical resolved inputs and settings.
Reproducibility across changing service responses requires separately captured inputs, such as snapshots, and is otherwise not guaranteed.

## Builds, diagnostics, and compatibility

1. Read project settings, classify and collect documents/programs, and validate references and publication selection.
2. Run extensions to resolve data and finalize the page list, route table, and output plan.
3. Validate collisions and output paths before converting Markdown to document data and compiling/executing required programs, templates, and layouts.
4. Publish HTML and assets only after generation succeeds for every page.

Process identical inputs in a stable order, also stabilizing diagnostics and output lists.
Do not report generation failures as success or publish partial new output as a complete site.
Define safe staging/publication and handling of outputs from deleted pages before implementation;
do not bulk-delete user files or arbitrary directories.
Associate diagnostics with files, Markdown body locations, FrontMatter fields or fence locations, routes, and processing stages,
returning the same information to the CLI and Desktop.
Cancellation and re-runs follow the shared engine proposal.

Preserve the existing configuration-free, single-page CLI and explicitly opt into site generation.
Do not change grammar, compiler ABI, or HTML escaping, require `site` fields in existing documents,
or implicitly migrate old projects lacking layout and route declarations.

## Development order and validation

| Stage | Work | Completion evidence |
| --- | --- | --- |
| 1 | Extract the shared engine from the existing CLI | Existing CLI tests and identical HTML, CSS, and license output |
| 2 | Markdown document data, document/program classification, page data, multiple pages, one shared layout level, route output | Acceptance/rejection/boundary tests below, generated HTML and URL verification |
| 3 | Explicit external data extensions | Generation using the same page contract, failure diagnostics, rebuilds after dependency changes |
| 4 | Apply to the official website | Compare build JavaScript reduction; regression checks for existing HTML, URLs, base paths, and serving behavior |

Implementation validation includes at least:

- Collection of `.md` without FrontMatter or Matra code, single-file/folder references, bodies, and optional metadata.
- No execution of program-named fences in documents; rejection of conflicting classifications and invalid program settings.
- Pages/article indexes generated from document folders, no publication of reference-only documents, and document/program route collisions.
- Markdown body locations, relative links/images, raw HTML handling, and regeneration after document additions/changes/deletions.
- Two pages sharing a layout without data leaking between them.
- Shared data, empty bodies, multiple body nodes, complete documents without layouts, and special-character escaping.
- Both directory and flat styles, explicit routes, root and nested routes, base paths, and canonical URLs.
- Diagnostics for unknown settings/layouts, missing data, invalid document results, and public-name collisions.
- Rejection of route/asset/case/file-directory collisions, output escapes, and symlinks.
- Successful and failed asynchronous retrieval, invalid extension results, watching, cancellation, and re-runs after consecutive saves.
- No partial-site publication on failure, output after page deletion, and byte-identical output for identical inputs.
- Identical CLI/Desktop artifacts and diagnostics, with the existing single-page path unchanged.

Documentation-only changes do not need bootstrap verification.
If implementation affects the compiler or ABI, treat that as a separate specification change
and apply existing verification requirements, including Stage 2/3 byte equality.

## Decisions for future stages

- Public APIs for document selection/references, source locations in document records, and image processing extensions.
- Canonical URLs, origin, and URL exposure including the base path.
- Extension APIs for registration, results, source locations, and dependency inputs.
- Watching/cancellation, Desktop integration, and migration assistance for legacy output without a manifest.
- Detailed diagnostic locations.
