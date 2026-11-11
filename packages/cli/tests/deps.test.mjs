import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { deflateRawSync } from "node:zlib"
import { buildLiterate, runLiterate } from "@matra/core/experimental/literate"

const cli = fileURLToPath(new URL("../src/cli.mjs", import.meta.url))

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function wheelZip(files) {
  const local = []
  const central = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const filename = Buffer.from(name)
    const source = Buffer.from(content)
    const compressed = deflateRawSync(source)
    const crc = crc32(source)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(8, 8)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(source.length, 22)
    localHeader.writeUInt16LE(filename.length, 26)
    local.push(localHeader, filename, compressed)
    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(compressed.length, 20)
    centralHeader.writeUInt32LE(source.length, 24)
    centralHeader.writeUInt16LE(filename.length, 28)
    centralHeader.writeUInt32LE(offset, 42)
    central.push(centralHeader, filename)
    offset += localHeader.length + filename.length + compressed.length
  }
  const centralDirectory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, centralDirectory, end])
}

async function tempRoot(t) {
  const root = await mkdtemp(join(tmpdir(), "matra-deps-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function executable(path, source) {
  await writeFile(path, `#!${process.execPath}\n${source}\n`)
  await chmod(path, 0o755)
}

test("deps install uses Matra Command, confirms network access, and creates the shared Python lock", async t => {
  const root = await tempRoot(t)
  const bin = join(root, "bin")
  await mkdir(bin)
  await writeFile(join(root, "package.json"), JSON.stringify({ private: true }))
  await writeFile(
    join(root, "index.md"),
    `---
matra:
  entry: main.matra
  values: [value.py]
  python:
    packages: [sample-wheel==1.0]
---
\`\`\`main.matra
p { value.answer }
\`\`\`
\`\`\`value.py
from sample_pkg import answer
__all__ = ["answer"]
\`\`\`
`,
  )
  const wheel = wheelZip({
    "sample_pkg/__init__.py": "answer = 42\n",
    "sample_wheel-1.0.dist-info/METADATA":
      "Metadata-Version: 2.1\nName: sample-wheel\nVersion: 1.0\nRequires-Dist: optional-dep; extra == 'feature'\nRequires-Dist: windows-dep; sys_platform == 'win32'\n\n",
    "sample_wheel-1.0.dist-info/WHEEL":
      "Wheel-Version: 1.0\nGenerator: test\nRoot-Is-Purelib: true\nTag: py3-none-any\n\n",
    "sample_wheel-1.0.dist-info/top_level.txt": "sample_pkg\n",
  }).toString("base64")
  const pipLog = join(root, "pip-args.json")
  await executable(
    join(bin, "python3"),
    `const fs=require("node:fs"); const path=require("node:path");
const args=process.argv.slice(2);
fs.writeFileSync(process.env.MATRA_TEST_PIP_LOG, JSON.stringify(args));
fs.writeFileSync(path.join(args[args.indexOf("--dest")+1], "sample_wheel-1.0-py3-none-any.whl"), Buffer.from("${wheel}", "base64"));`,
  )
  const npmLog = join(root, "npm-args.json")
  await executable(
    join(bin, "npm"),
    `require("node:fs").writeFileSync(process.env.MATRA_TEST_NPM_LOG, JSON.stringify(process.argv.slice(2)));`,
  )
  const result = spawnSync(process.execPath, [cli, "deps", "install", "index.md", "--yes"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: bin,
      MATRA_TEST_PIP_LOG: pipLog,
      MATRA_TEST_NPM_LOG: npmLog,
    },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /network access/)
  assert.deepEqual(JSON.parse(await readFile(npmLog, "utf8")), [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ])
  const pipArgs = JSON.parse(await readFile(pipLog, "utf8"))
  assert.deepEqual(pipArgs.slice(0, 3), ["-m", "pip", "download"])
  assert.ok(pipArgs.includes("--only-binary=:all:"))
  assert.ok(pipArgs.includes("--platform") && pipArgs[pipArgs.indexOf("--platform") + 1] === "any")
  assert.ok(pipArgs.includes("sample-wheel==1.0"))
  const lock = JSON.parse(await readFile(join(root, "matra.python.lock.json"), "utf8"))
  assert.equal(lock.format, "matra-python-wheels-1")
  assert.equal(lock.pyodide, "314.0.7")
  assert.deepEqual(
    lock.packages.map(({ name, version, file, sha256 }) => ({ name, version, file, sha256 })),
    [
      {
        name: "sample-wheel",
        version: "1.0",
        file: "wheels/sample_wheel-1.0-py3-none-any.whl",
        sha256: createHash("sha256").update(Buffer.from(wheel, "base64")).digest("hex"),
      },
    ],
  )
  assert.deepEqual(
    await readFile(join(root, "wheels/sample_wheel-1.0-py3-none-any.whl")),
    Buffer.from(wheel, "base64"),
  )
  const bundle = await buildLiterate(await readFile(join(root, "index.md"), "utf8"), {
    moduleRoot: root,
  })
  assert.deepEqual(await runLiterate(bundle, { moduleRoot: root }), {
    tag: "p",
    props: {},
    children: [42],
  })
})

test("deps install does not execute commands without an explicit confirmation", async t => {
  const root = await tempRoot(t)
  const marker = join(root, "unexpected")
  await writeFile(join(root, "package.json"), JSON.stringify({ private: true }))
  await writeFile(join(root, "index.md"), `---\nmatra:\n  entry: main.matra\n---\n`)
  const bin = join(root, "bin")
  await mkdir(bin)
  await executable(
    join(bin, "npm"),
    `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran");`,
  )
  const result = spawnSync(process.execPath, [cli, "deps", "install", "index.md"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: bin },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /rerun with --yes/)
  await assert.rejects(readFile(marker), { code: "ENOENT" })
})

test("deps install rejects conflicting versions in the project-wide Python lock", async t => {
  const root = await tempRoot(t)
  const bin = join(root, "bin")
  await mkdir(bin)
  await writeFile(
    join(root, "index.md"),
    `---
matra:
  entry: main.matra
  python:
    packages: [sample-wheel==1.0]
---
`,
  )
  const bytes = wheelZip({
    "sample_wheel-2.0.dist-info/METADATA":
      "Metadata-Version: 2.1\nName: sample-wheel\nVersion: 2.0\n\n",
    "sample_wheel-2.0.dist-info/WHEEL":
      "Wheel-Version: 1.0\nGenerator: test\nRoot-Is-Purelib: true\nTag: py3-none-any\n\n",
  })
  await mkdir(join(root, "wheels"))
  await writeFile(join(root, "wheels/sample_wheel-2.0-py3-none-any.whl"), bytes)
  await writeFile(
    join(root, "matra.python.lock.json"),
    JSON.stringify({
      format: "matra-python-wheels-1",
      pyodide: "314.0.7",
      packages: [
        {
          name: "sample-wheel",
          version: "2.0",
          file: "wheels/sample_wheel-2.0-py3-none-any.whl",
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
    }),
  )
  await executable(
    join(bin, "python3"),
    `const fs=require("node:fs"); const path=require("node:path"); const args=process.argv.slice(2);
fs.writeFileSync(path.join(args[args.indexOf("--dest")+1], "sample_wheel-1.0-py3-none-any.whl"), Buffer.from(${JSON.stringify(
      wheelZip({
        "sample_wheel-1.0.dist-info/METADATA":
          "Metadata-Version: 2.1\nName: sample-wheel\nVersion: 1.0\n\n",
        "sample_wheel-1.0.dist-info/WHEEL":
          "Wheel-Version: 1.0\nGenerator: test\nRoot-Is-Purelib: true\nTag: py3-none-any\n\n",
      }).toString("base64"),
    )}, "base64"));`,
  )
  const result = spawnSync(process.execPath, [cli, "deps", "install", "index.md", "--yes"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: bin, MATRA_PYTHON: join(bin, "python3") },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Python lock conflict for sample-wheel/)
  assert.equal(
    JSON.parse(await readFile(join(root, "matra.python.lock.json"), "utf8")).packages[0].version,
    "2.0",
  )
})
