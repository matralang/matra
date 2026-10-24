import assert from "node:assert/strict"
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { programSource } from "../host/compiler-host.mjs"
import {
  createNodeRuntime,
  instantiatePortable,
  PortableRuntimeError,
  projectPath,
} from "../host/node-runtime.mjs"
import { instantiateUnified } from "../host/unified-host.mjs"
import { spawnSync } from "./helpers/process.mjs"

const cli = fileURLToPath(new URL("../host/portable.mjs", import.meta.url))
const sample = new URL("../examples/portable/", import.meta.url)

async function temporaryProject(t) {
  const root = await mkdtemp(join(tmpdir(), "matra portable 日本語 "))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

function hasCode(code) {
  return error => error instanceof PortableRuntimeError && error.code === code
}

function invoke(...args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: tmpdir(),
    encoding: "utf8",
    timeout: 120000,
  })
  assert.ifError(result.error)
  assert.equal(result.signal, null)
  return result
}

test("bootstrap source extraction accepts LF and Windows CRLF checkouts", () => {
  const markdown = "# Compiler\n```compiler.matra\nmodule compiler\n```\n"
  for (const document of [markdown, markdown.replaceAll("\n", "\r\n")]) {
    assert.equal(programSource(document, "compiler.matra"), "module compiler")
  }
  assert.throws(() => programSource("", "compiler.matra"), /not found/)
  assert.throws(
    () => programSource("```compiler.matra\nmodule compiler", "compiler.matra"),
    /not closed/,
  )
})

test("text API preserves UTF-8, BOM, line endings and exact stdout bytes", async t => {
  const root = await temporaryProject(t)
  await mkdir(join(root, "data"))
  const original = "\ufeff日本語😀\r\nsecond\n"
  await writeFile(join(root, "data", "入力 file.txt"), original)
  const output = []
  const args = ["data/入力 file.txt", "hello world"]
  const runtime = createNodeRuntime({
    root,
    args,
    stdout: { write: value => output.push(value) },
  })
  args[0] = "changed"
  assert.equal(runtime.version, "0.3")
  assert.deepEqual(runtime.args, ["data/入力 file.txt", "hello world"])
  assert.ok(Object.isFrozen(runtime.args))
  assert.equal(runtime.read_text("data/入力 file.txt"), original)
  assert.equal(runtime.write_text("data/output.txt", original), null)
  assert.deepEqual(await readFile(join(root, "data", "output.txt")), Buffer.from(original, "utf8"))
  assert.equal(runtime.print("日本語😀"), null)
  assert.deepEqual(output, ["日本語😀\n"])
  assert.equal(runtime.write_text("data/output.txt", ""), null)
  assert.equal(runtime.read_text("data/output.txt"), "")
})

test("portable paths reject OS-specific, escaping and ambiguous names before I/O", async t => {
  const root = await temporaryProject(t)
  for (const path of [
    "",
    "/tmp/file",
    "C:/file",
    "data\\file",
    "../outside",
    "data/../file",
    "./file",
    "data//file",
    "file/",
    "NUL.txt",
    "CONIN$",
    "CONOUT$.txt",
    "com1",
    "LPT².log",
    "space ",
    "dot.",
    "bad:name",
    "wild*card",
    "a?b",
    "a|b",
    "a<b",
    'a"b',
    "a\u0000b",
    "a\nb",
    "a\u0085b",
    "e\u0301.txt",
  ]) {
    assert.throws(() => projectPath(root, path, { write: true }), hasCode("INVALID_PATH"), path)
  }
  for (const path of [null, 1, [], {}, "\ud800"]) {
    assert.throws(() => projectPath(root, path), hasCode("INVALID_ARGUMENT"))
  }
  await writeFile(join(root, "Exact.txt"), "case")
  assert.throws(() => projectPath(root, "exact.txt"), hasCode("CASE_MISMATCH"))
  assert.throws(() => projectPath(root, "EXACT.txt", { write: true }), hasCode("CASE_MISMATCH"))
  assert.equal(await readFile(join(root, "Exact.txt"), "utf8"), "case")
})

test("host errors distinguish missing files, directories, invalid UTF-8 and arguments", async t => {
  const root = await temporaryProject(t)
  await mkdir(join(root, "directory"))
  await writeFile(join(root, "invalid.txt"), new Uint8Array([0xc3, 0x28]))
  await writeFile(join(root, "file.txt"), "file")
  const runtime = createNodeRuntime({ root })
  assert.throws(() => runtime.read_text("missing.txt"), hasCode("NOT_FOUND"))
  assert.throws(() => runtime.read_text("directory"), hasCode("NOT_FILE"))
  assert.throws(() => runtime.write_text("directory", "bad"), hasCode("NOT_FILE"))
  assert.throws(() => runtime.read_text("file.txt/child"), hasCode("NOT_DIRECTORY"))
  assert.throws(() => runtime.write_text("missing/child.txt", "bad"), hasCode("NOT_FOUND"))
  assert.throws(() => runtime.read_text("invalid.txt"), hasCode("INVALID_UTF8"))
  assert.throws(() => runtime.write_text("file.txt", 42), hasCode("INVALID_ARGUMENT"))
  assert.throws(() => runtime.write_text("file.txt", "\ud800"), hasCode("INVALID_ARGUMENT"))
  assert.throws(() => runtime.print(null), hasCode("INVALID_ARGUMENT"))
  assert.throws(() => createNodeRuntime({ root, args: [null] }), hasCode("INVALID_ARGUMENT"))
  assert.throws(() => createNodeRuntime({ root, args: "bad" }), hasCode("INVALID_ARGUMENT"))
  assert.throws(() => createNodeRuntime({ root: join(root, "file.txt") }), hasCode("NOT_DIRECTORY"))
  assert.equal(runtime.read_text("file.txt"), "file")
})

test("portable lookup accepts NFC names and rejects normalization or case collisions", async t => {
  const root = await temporaryProject(t)
  await writeFile(join(root, "café.txt"), "unicode")
  const runtime = createNodeRuntime({ root })
  assert.equal(runtime.read_text("café.txt"), "unicode")
  // case-sensitive な filesystem でのみ共存できる名前を実際に作成して検査する。
  await writeFile(join(root, "Case.txt"), "one")
  await writeFile(join(root, "case.txt"), "two")
  const names = await readdir(root)
  if (names.includes("Case.txt") && names.includes("case.txt")) {
    assert.throws(() => runtime.read_text("Case.txt"), hasCode("CASE_MISMATCH"))
  } else {
    assert.equal(runtime.read_text("Case.txt"), "two")
  }
})

test("symlinks are rejected, including parent directories and dangling targets", async t => {
  const root = await temporaryProject(t)
  await mkdir(join(root, "directory"))
  // Windows の junction は管理者権限なしで作成できる。
  await symlink(join(root, "directory"), join(root, "link"), "junction")
  const runtime = createNodeRuntime({ root })
  assert.throws(() => runtime.write_text("link/new.txt", "bad"), hasCode("SYMLINK"))
  if (process.platform !== "win32") {
    await symlink(join(root, "missing.txt"), join(root, "dangling.txt"))
    assert.throws(() => runtime.write_text("dangling.txt", "bad"), hasCode("SYMLINK"))
  }
})

test("permission failures are explicit without overwriting the file", async t => {
  if (process.platform === "win32" || process.getuid() === 0) {
    t.skip("POSIX file permissions require a non-root POSIX user")
    return
  }
  const root = await temporaryProject(t)
  const file = join(root, "private.txt")
  await writeFile(file, "unchanged")
  await chmod(file, 0)
  try {
    const runtime = createNodeRuntime({ root })
    assert.throws(() => runtime.read_text("private.txt"), hasCode("ACCESS_DENIED"))
    assert.throws(() => runtime.write_text("private.txt", "changed"), hasCode("ACCESS_DENIED"))
  } finally {
    await chmod(file, 0o600)
  }
  assert.equal(await readFile(file, "utf8"), "unchanged")
})

test("self-hosted build and run execute the unchanged portable project", async t => {
  const root = await temporaryProject(t)
  for (const name of ["main.matra", "input.txt"]) {
    await copyFile(new URL(name, sample), join(root, name))
  }
  const build = invoke("build", root, "main.matra", "main.wasm")
  assert.equal(build.status, 0, build.stderr)
  const bytes = await readFile(join(root, "main.wasm"))
  assert.equal(WebAssembly.validate(bytes), true)
  assert.ok(
    WebAssembly.Module.imports(await WebAssembly.compile(bytes)).every(
      item => item.module === "matra",
    ),
  )
  const run = invoke("run", root, "main.wasm")
  assert.equal(run.status, 0, run.stderr)
  assert.equal(run.stdout, "Wrote output.txt\n")
  assert.equal(run.stderr, "")
  assert.deepEqual(
    await readFile(join(root, "output.txt")),
    Buffer.from("Matra v0.3: Hello, portable Matra!\nこんにちは、Matra!\n"),
  )

  await writeFile(join(root, "別の input.txt"), "引数から\r\n")
  const withArgs = invoke("run", root, "main.wasm", "別の input.txt")
  assert.equal(withArgs.status, 0, withArgs.stderr)
  assert.deepEqual(
    await readFile(join(root, "output.txt")),
    Buffer.from("Matra v0.3: 引数から\r\n"),
  )
  const output = []
  const portable = await instantiatePortable(bytes, {
    root,
    stdout: { write: value => output.push(value) },
  })
  assert.equal(portable.run(), null)
  assert.deepEqual(output, ["Wrote output.txt\n"])
  const plain = await instantiateUnified(bytes)
  assert.throws(() => plain.run(), /Unknown name: runtime/)

  await t.test("failures exit nonzero without a success message or changed output", async () => {
    const expected = await readFile(join(root, "output.txt"))
    for (const [path, code] of [
      ["missing.txt", "NOT_FOUND"],
      ["../outside.txt", "INVALID_PATH"],
      ["Input.txt", "CASE_MISMATCH"],
    ]) {
      const failure = invoke("run", root, "main.wasm", path)
      assert.equal(failure.status, 1)
      assert.equal(failure.stdout, "")
      assert.match(failure.stderr, new RegExp(`^${code}:`))
      assert.deepEqual(await readFile(join(root, "output.txt")), expected)
    }
    for (const args of [
      [],
      ["unknown"],
      ["build", root, "main.matra"],
      ["build", root, "main.matra", "main.wasm", "extra"],
    ]) {
      const failure = invoke(...args)
      assert.equal(failure.status, 1)
      assert.match(failure.stderr, /Usage:/)
    }
    const overwrite = invoke("build", root, "main.matra", "main.matra")
    assert.equal(overwrite.status, 1)
    assert.match(overwrite.stderr, /must not overwrite/)
    await writeFile(join(root, "bad.matra"), "let value =")
    const invalid = invoke("build", root, "bad.matra", "bad.wasm")
    assert.equal(invalid.status, 1)
    assert.match(invalid.stderr, /parse error/)
    await assert.rejects(readFile(join(root, "bad.wasm")), { code: "ENOENT" })
    await writeFile(join(root, "invalid.wasm"), "not wasm")
    const invalidWasm = invoke("run", root, "invalid.wasm")
    assert.equal(invalidWasm.status, 1)
    assert.equal(invalidWasm.stdout, "")
    assert.match(invalidWasm.stderr, /WebAssembly/)
  })
})
