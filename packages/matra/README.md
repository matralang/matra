# matra

[English](./README.md) | [日本語](./README.ja.md)

`matra` is an alias package for [`@matra/cli`](../cli). Installing it pulls in
`@matra/cli` and exposes the same `matra` command, so you can start with the
short package name.

## Positioning

This package is currently a thin alias that only delegates to `@matra/cli`.
In an upcoming minor release it is planned to grow into the main entry point
of the Matra language by adding a curated, minimal programmatic API — for
example `parse`, `evaluate`, `toHTML`, and the `matra` factory — as named
exports plus a default export object, re-exported from packages such as
`@matra/core` and `@matra/html`. Deeper APIs will remain available from the
individual `@matra/*` packages. These additions will be non-breaking; the
`matra` command will keep working as it does today.

## Installation

Node.js 22 or 24 is required.

```sh
npm install --global matra
```

This is equivalent to:

```sh
npm install --global @matra/cli
```

## Uninstallation

Uninstall with the same package name you installed:

```sh
npm uninstall --global matra
```

If you installed `@matra/cli` directly, run
`npm uninstall --global @matra/cli` instead. Uninstalling the wrong name does
not remove the package and exits without an error. Check the installed
package name with `npm ls --global --depth=0`.

## Quick start

```sh
matra init hello
cd hello
matra build
matra dev
```

See [`@matra/cli`](../cli) for the full command reference. This package
contains no logic of its own; it only delegates to `@matra/cli`.

## License

MIT
