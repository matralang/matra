# Matra build tools

[English](./README.md) | [日本語](./README.ja.md)

This experimental folder distribution includes Node.js. Do not move its internal files
independently. The `init`, `build`, `site`, and `dev` commands need no system Node.js, npm,
pnpm, Rust, or network connection. `deps install` requires npm, Python 3 with pip, and network access.
Native builders target macOS, Linux, and Windows on x64 and arm64. Choose the archive
matching your OS/CPU. Linux requires a glibc-based environment supported by official
Node.js; Alpine/musl is not supported. CI coverage is distinct from a published release.

## Get started

Extract the ZIP, then add the extracted folder to PATH in your terminal.
Replace the example path with the actual location. This does not install anything globally.
Use a real directory, not a symlink to the launcher.

macOS / Linux:

```sh
export PATH="/absolute/path/to/extracted-matra-folder:$PATH"
matra --version
matra init hello
cd hello
matra build
```

Windows PowerShell:

```powershell
$env:Path = "C:\path\to\extracted-matra-folder;$env:Path"
matra --version
matra init hello
cd hello
matra build
```

Open `dist/index.html` in a browser (`open dist/index.html` on macOS).
Windows uses `matra.cmd`; macOS/Linux use `matra`. Run from a terminal, not by double-clicking.
The `hello` directory must not already exist. Edit `index.md` and `matra.css`, then rebuild.
To preview changes using a local server:

```sh
matra dev
```

Open the printed URL (`http://127.0.0.1:3000/` by default).
Changes rebuild automatically; refresh the browser manually. Ctrl+C stops the server.
Use `matra dev --port 3001` if the default port is occupied.

`matra build` executes selected JavaScript in `index.md`; `matra site build` executes only
explicit `.matra.md` pages and layouts. Ordinary site Markdown is rendered as content.
Build only trusted programs: execution has no OS sandbox or timeout.
The development server serves only generated HTML, CSS, and the CSS license.
Build errors appear in the terminal and return HTTP 503 until fixed.
macOS may require approval for software downloaded from the Internet. This development
distribution is not signed or notarized; follow your organization's security policy.

Use `matra deps install index.md` to install dependencies before building. It uses npm's
`package.json` and lockfile, and downloads only Pyodide-compatible `py3-none-any` wheels
declared by the selected document. It confirms network access first and disables npm lifecycle
scripts. Python wheels require a system Python 3 with pip; the standalone distribution does
not bundle a package manager.

## Declarative sites

For multi-page sites, add exactly one of `matra.site.yaml`, `matra.site.json`, or
`matra.site.matra` to the project root and run:

```sh
matra site build
```

Ordinary `.md` files under the configured pages directory are Markdown pages.
Use `.matra.md` only for executable page programs and layouts.
The command writes route-based HTML into the configured output directory.
See the [site-generation contract](https://github.com/matralang/matra/blob/main/spec/site-generation.md)
for configuration and supported behavior.

## Contents and provenance

- `matra` (macOS/Linux) or `matra.cmd` (Windows): launcher using bundled Node.js
- `runtime/bin/node` (macOS/Linux) or `runtime/node.exe` (Windows): pinned official Node.js
- `app/node_modules/`: Matra CLI, libraries, compiler Wasm/manifest, and template
- `LICENSE`, `licenses/`: Matra and third-party license notices, including Node.js notices
- `versions.json`: exact versions, Node.js download/checksum, compiler manifest,
  source commit, dirty-tree flag, and dependency-lockfile checksum

The adjacent `.zip.sha256` file records the ZIP's SHA-256 checksum.
These files are development build artifacts, not a declaration of a published release
or bit-for-bit reproducible archives. Keep the entire folder and its license notices together.
