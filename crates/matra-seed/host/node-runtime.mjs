import { lstatSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { instantiateUnified } from "./unified-host.mjs"

export class PortableRuntimeError extends Error {
  constructor(code, message, options) {
    super(message, options)
    this.name = "PortableRuntimeError"
    this.code = code
  }
}

function io(operation, path, action) {
  try {
    return action()
  } catch (error) {
    if (error instanceof PortableRuntimeError) throw error
    const codes = {
      ENOENT: "NOT_FOUND",
      ENOTDIR: "NOT_DIRECTORY",
      EISDIR: "IS_DIRECTORY",
      EACCES: "ACCESS_DENIED",
      EPERM: "ACCESS_DENIED",
    }
    throw new PortableRuntimeError(
      codes[error.code] ?? "IO_ERROR",
      `${operation}: ${path}: ${error.message}`,
      { cause: error },
    )
  }
}

function text(value, name) {
  if (typeof value !== "string") {
    throw new PortableRuntimeError("INVALID_ARGUMENT", `${name} must be a string`)
  }
  // 孤立 surrogate を UTF-8 変換時の置換文字として黙って書き出さない。
  if (!value.isWellFormed()) {
    throw new PortableRuntimeError("INVALID_ARGUMENT", `${name} must be valid Unicode`)
  }
  return value
}

export function projectPath(root, path, { write = false } = {}) {
  text(root, "root")
  text(path, "path")
  const parts = path.split("/")
  if (
    parts.some(
      part =>
        !part ||
        part === "." ||
        part === ".." ||
        /[\p{Cc}<>:"\\|?*]/u.test(part) ||
        /[. ]$/u.test(part) ||
        /^(con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(part) ||
        part.normalize("NFC") !== part,
    )
  ) {
    throw new PortableRuntimeError("INVALID_PATH", `Expected a portable relative path: ${path}`)
  }

  return io("path", path, () => {
    let current = realpathSync(root)
    if (!lstatSync(current).isDirectory()) {
      throw new PortableRuntimeError("NOT_DIRECTORY", `Project root is not a directory: ${root}`)
    }
    for (const [index, part] of parts.entries()) {
      const entries = readdirSync(current)
      const matches = entries.filter(
        name => name.normalize("NFC").toLowerCase() === part.toLowerCase(),
      )
      if (matches.length > 1 || (matches.length === 1 && matches[0].normalize("NFC") !== part)) {
        throw new PortableRuntimeError("CASE_MISMATCH", `Ambiguous or mismatched filename: ${path}`)
      }
      current = join(current, matches[0] ?? part)
      const last = index === parts.length - 1
      if (matches.length === 0 && last && write) return current
      const stat = lstatSync(current)
      if (stat.isSymbolicLink()) {
        throw new PortableRuntimeError("SYMLINK", `Symlinks are not supported: ${path}`)
      }
      if (!last && !stat.isDirectory()) {
        throw new PortableRuntimeError("NOT_DIRECTORY", `Not a directory: ${path}`)
      }
      if (last && !stat.isFile()) {
        throw new PortableRuntimeError("NOT_FILE", `Expected a regular file: ${path}`)
      }
    }
    return current
  })
}

export function createNodeRuntime({ root, args = [], stdout = process.stdout }) {
  text(root, "root")
  if (!Array.isArray(args)) {
    throw new PortableRuntimeError("INVALID_ARGUMENT", "args must be a string array")
  }
  const runtimeArgs = Object.freeze(args.map(arg => text(arg, "argument")))
  const projectRoot = io("root", root, () => realpathSync(root))
  if (!io("root", root, () => lstatSync(projectRoot).isDirectory())) {
    throw new PortableRuntimeError("NOT_DIRECTORY", `Project root is not a directory: ${root}`)
  }
  return Object.freeze({
    version: "0.3",
    args: runtimeArgs,
    read_text(path) {
      const file = projectPath(projectRoot, path)
      const bytes = io("read", path, () => readFileSync(file))
      try {
        return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
      } catch (error) {
        throw new PortableRuntimeError("INVALID_UTF8", `Invalid UTF-8 text: ${path}`, {
          cause: error,
        })
      }
    },
    write_text(path, value) {
      text(value, "text")
      const file = projectPath(projectRoot, path, { write: true })
      io("write", path, () => writeFileSync(file, value, "utf8"))
      return null
    },
    print(value) {
      text(value, "text")
      stdout.write(`${value}\n`)
      return null
    },
  })
}

export async function instantiatePortable(bytes, options) {
  const runtime = createNodeRuntime(options)
  return instantiateUnified(bytes, { globals: { runtime } })
}
