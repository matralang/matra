# Matra

[English](./README.md) | [日本語](./README.ja.md)

Matra is maintained as a pnpm workspace monorepo. Published packages keep the
`@matra/*` scope.

## Specification

- [Matra Language White Paper v0.3](spec/whitepaper-v0.3.md) — design, document model,
  execution/output maturity, and changes from historical implementations.
- [Matra Specification (source grammar v0.3)](spec/README.md)
- [Matra Specification（日本語）](spec/README.ja.md)
- [Proposed v0.3 scope and release criteria](spec/release-v0.3.md)

## Web page validation example

Keep prose, Matra structure, and JavaScript data/functions in
[one Markdown document](packages/html/examples/web-page.md), then generate a complete
HTML page with bundled CSS. With Node.js 22/24, pnpm and the repository's Rust toolchain:

```sh
pnpm install --frozen-lockfile
pnpm example:web-page
pnpm test:web-page
```

Open `packages/html/examples/dist/index.html` in a browser. The generated page works
offline. This example uses the implemented `.js.part` subset; standard JavaScript
modules, npm and Python integration remain outside this route.

## Matra build tools (development)

`@matra/cli` provides `matra init` to create a first page without manually assembling
configuration or project dependencies. Development scripts now build and verify
native folders and ZIPs with bundled Node.js for macOS, Linux, and Windows on x64/arm64,
with a six-target CI workflow. All six targets passed CLI tests, ZIP creation,
and re-extraction on commit `2056aee` in
[run 41005130597](https://github.com/matralang/matra/actions/runs/41005130597).
Local execution is also verified on macOS / arm64.
The distribution is not signed or notarized.

### Try the experimental distribution

Download the ZIP and checksum for your OS/CPU from the
[0.3.1-alpha.1 Pre-release](https://github.com/matralang/matra/releases/tag/build-tools-v0.3.1-alpha.1).
This is for interested developers, not a stable release. See the release page for download,
checksum, extraction, PATH instructions, and verification scope.
System Node.js, pnpm, and Rust are not needed. A dedicated installer and npm CLI installation
are not yet provided.

**Chrome on Windows has been reported to block the download as dangerous.**
The cause is unknown; a false positive has not been established. Stop downloading or running
the files if warned. Do not disable protection or ignore warnings. Checksums do not guarantee safety.

### Try from the repository

With Node.js 22/24, pnpm, and the repository's Rust toolchain, run from the repository root
(the PATH example is for macOS/Linux):

```sh
pnpm install --frozen-lockfile
pnpm --filter @matra/core run build
pnpm --filter @matra/html run build
export PATH="$PWD/node_modules/.bin:$PATH"
matra init hello
cd hello
matra build
```

On Windows, add the repository's `node_modules/.bin` to PATH and use the same `matra`
commands. The destination must **not already exist**, even as an empty directory.
Its parent directory must exist. The generated project contains:

```text
hello/
  index.md           # FrontMatter, Matra structure, and JavaScript data
  matra.css          # Editable CSS from @matra/styles
  matra.css.LICENSE  # CSS license
  .gitignore         # Excludes /dist/
```

The entry document (`index.md`), stylesheet (`matra.css`), and output directory (`dist/`)
are fixed conventions, requiring no configuration file. Run `matra build` in the project
directory to compile and execute the document and generate/update `dist/index.html`,
`dist/matra.css`, and `dist/matra.css.LICENSE`. Open the HTML directly in a browser;
viewing needs no network. Unknown output files are not deleted, and symlink output paths
are rejected. Only build trusted documents: their JavaScript executes during the build.
The existing literate API, `matra-literate` CLI, and language grammar are unchanged.
Execution uses the bundled compiler Wasm and manifest without Rust, pnpm, or a network;
preparing and packing the development tools still requires Rust and pnpm.

### Local preview

Run inside the generated project:

```sh
matra dev
```

After the initial build, open `http://127.0.0.1:3000/`. Changes to `index.md`,
`matra.css`, and `matra.css.LICENSE` automatically rebuild the project.
Refresh the browser manually; live reload and automatic browser launch are not implemented.
An occupied port fails explicitly; use `matra dev --port 3001` to choose another.
The server binds only to `127.0.0.1`, not external network interfaces.
It serves only generated HTML, CSS, and the CSS license, never source documents or other files.

An initial build failure prevents startup. Later build failures are reported in the terminal
and return HTTP 503 with a plain-text diagnostic for generated asset requests.
Previous output files remain on disk; serving resumes after a successful rebuild.
Press Ctrl+C to stop the server and file monitoring.

Run `pnpm test:cli` for initialization, HTML/CSS generation, and error handling.
`pnpm test:literate:package` packs the CLI, template, CSS, and compiler and verifies
init/build/dev outside the checkout without external commands.

### Building a Node.js-inclusive ZIP

The builder needs Node.js 22/24, pnpm, the repository's Rust toolchain, `tar`, `zip`,
`unzip`, and a network connection. Windows instead uses `tar` and standard Windows
PowerShell/.NET ZIP APIs, with no `zip`/`unzip` commands required.
Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm distribution:build
```

The script downloads official Node.js `24.17.0`, verifies its
[pinned checksum](packages/cli/distribution/node.json), and then extracts it.
It packs Matra packages and assembles their runtime dependencies in a self-contained
folder with compiler Wasm/manifest, template, CSS, licenses, and `versions.json`.
npm and pnpm are not included.

The builder targets its native OS/CPU, never cross-compiling. Targets are
`darwin-arm64`, `darwin-x64`, `linux-arm64`, `linux-x64`, `win32-arm64`, and `win32-x64`.
Linux requires a glibc environment supported by official Node.js; Alpine/musl is excluded.
Outputs are `dist/releases/matra-0.3.1-alpha.1-TARGET/`, its `.zip`, and `.zip.sha256`.
Both the staged folder and re-extracted ZIP are relocated to paths containing spaces
and Japanese characters and tested with an empty PATH: launch, init/build/dev, rebuild,
shutdown, compiler, and license checks. Existing artifacts are never overwritten.
Windows verifies init/build through `matra.cmd` and dev through bundled Node.js,
terminating the dev process after tests; interactive Ctrl+C is not automatically verified.
To rebuild, choose another destination, such as
`pnpm distribution:build --output dist/another-release`.
Bit-for-bit archive reproducibility is not guaranteed. `versions.json` records the source
commit and dirty-tree flag.

Users extract the ZIP and add the **extracted folder** to PATH. The launcher uses
bundled Node.js; system Node.js, pnpm, Rust, and network access are not needed.
See the [distribution guide](packages/cli/distribution/README.md).
Use the real folder, not a relocated or symlinked launcher.

```sh
export PATH="/absolute/path/to/matra-0.3.1-alpha.1-darwin-arm64:$PATH"
matra init hello
cd hello
matra build
matra dev
```

On Windows PowerShell, add the extracted folder to PATH:

```powershell
$env:Path = "C:\path\to\matra-0.3.1-alpha.1-win32-x64;$env:Path"
matra init hello
cd hello
matra build
matra dev
```

Recheck an extracted folder with
`pnpm distribution:verify dist/releases/matra-0.3.1-alpha.1-darwin-arm64`.
macOS may require approval for downloaded software. This development distribution
is not signed or notarized.
The [distribution CI](.github/workflows/distribution.yml) runs CLI tests, ZIP creation,
and re-extraction on six native runners. Successful ZIPs/checksums are stored as
Actions artifacts for seven days. Experimental Release attachments are stored separately
and do not expire with Actions artifacts.
The distribution version follows the CLI, separately from Core/HTML and compiler ABI.
See the [prerelease procedure](spec/build-tools-release.md) for manually creating a Draft.
Normal CI never creates Drafts, and the manual workflow never publishes publicly.

## Portability policy

Matra's central goal is to resolve dependencies, start, build, and run the same project
using common APIs and supported packages on Windows, macOS, and Linux without changing
source or configuration. Portability, including dependencies, takes priority over
compatibility with arbitrary external CLIs.
Android and iOS initially target Web operation or partial support.

This is a goal for future formal support, not a guarantee of current behavior.
See the [portability policy and common runtime roadmap](spec/portable-runtime.md)
for existing assets, guarantee boundaries, open API decisions, and phased validation.

The small working v0.3 subset uses a Node.js host. Build the same sample to Wasm with
the Matra-written compiler, then read an input file, process it in Matra, and write
the result through common APIs. Prepare Node.js 22/24, pnpm, and the Rust toolchain,
then run from the repository root:

```text
pnpm portable -- build crates/matra-seed/examples/portable main.matra main.wasm
pnpm portable -- run crates/matra-seed/examples/portable main.wasm
```

This subset excludes package management, npm/Python integration, and standalone runtime distribution.
Three-OS CI is configured; this is not a declaration of formal support.

## Literate documents

`@matra/core/experimental/literate` provides an experimental Node.js 22/24 API
for building and running literate documents. It runs trusted document code
without an OS sandbox or timeout guarantee. Its compiler Wasm is bundled, so
Rust is not needed after installation. Standard JavaScript modules, npm, and
Python integration are not implemented. See the
[Core API and limitations](packages/core/README.md#experimental-nodejs-literate-api)
and [literate module contract](spec/literate-modules.md).

## Packages

- [`@matra/core`](packages/core)
- [`@matra/cli`](packages/cli)
- [`@matra/command`](packages/command)
- [`@matra/graphics`](packages/graphics)
- [`@matra/html`](packages/html)
- [`@matra/math`](packages/math)
- [`@matra/math-compute-engine`](packages/math-compute-engine)

## XML-style markup

Document nodes can also use XML-style markup. Attributes are strings; content consists of text
and child elements with whitespace preserved. Existing `tag(attrs) { ... }` remains supported.
The `<>` delimiters make Matra node boundaries explicit and also support `.class` shorthand.

```matra
<article>
  <p.lead>Hello <strong>Matra</strong>!</p>
  <img src="image.png" />
</article>
```

Full XML and HTML omission/tree-repair rules are not supported. See the
[grammar specification](spec/grammar.md#xml-style-markup) for the supported subset.

## Compiler bootstrap

See [`crates/matra-seed`](crates/matra-seed/README.md) for the Rust seed compiler and the
Matra bootstrap compiler status.

## Website

公式サイト・ドキュメント・Playgroundは
[`matralang/website`](https://github.com/matralang/website) で管理しています。

## Development

```sh
pnpm install
pnpm run build
pnpm test
pnpm run lint
```

Biome formats JavaScript, TypeScript, JSON, and CSS files. Run `pnpm run format` to format them.
