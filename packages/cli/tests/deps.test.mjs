import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { deflateRawSync } from "node:zlib"
import {
  buildLiterate,
  getLiterateDependencyDirectory,
  runLiterate,
} from "@matra/core/experimental/literate"

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

test("Python deps install resolves unpinned packages into a per-document lock", async t => {
  const root = await tempRoot(t)
  const bin = join(root, "bin")
  await mkdir(bin)
  await writeFile(
    join(root, "index.md"),
    `---
matra:
  entry: main.matra
  values: [value.py]
  python:
    packages: [sample-wheel]
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
  const pythonRoot = getLiterateDependencyDirectory(root, "index.md", "python")
  await executable(
    join(bin, "python3"),
    `const fs=require("node:fs"); const path=require("node:path");
const args=process.argv.slice(2);
fs.writeFileSync(process.env.MATRA_TEST_PIP_LOG, JSON.stringify(args));
fs.writeFileSync(path.join(args[args.indexOf("--dest")+1], "sample_wheel-1.0-py3-none-any.whl"), Buffer.from("${wheel}", "base64"));`,
  )
  const result = spawnSync(
    process.execPath,
    [cli, "deps", "install", "python", "index.md", "--yes"],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: bin,
        MATRA_TEST_PIP_LOG: pipLog,
      },
    },
  )
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /network access/)
  const pipArgs = JSON.parse(await readFile(pipLog, "utf8"))
  assert.deepEqual(pipArgs.slice(0, 3), ["-m", "pip", "download"])
  assert.ok(pipArgs.includes("--only-binary=:all:"))
  assert.ok(pipArgs.includes("--platform") && pipArgs[pipArgs.indexOf("--platform") + 1] === "any")
  assert.ok(pipArgs.includes("sample-wheel"))
  const lock = JSON.parse(await readFile(join(pythonRoot, "matra.python.lock.json"), "utf8"))
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
    await readFile(join(pythonRoot, "wheels/sample_wheel-1.0-py3-none-any.whl")),
    Buffer.from(wheel, "base64"),
  )
  const bundle = await buildLiterate(await readFile(join(root, "index.md"), "utf8"), {
    document: "index.md",
    moduleRoot: root,
  })
  assert.deepEqual(await runLiterate(bundle, { moduleRoot: root }), {
    tag: "p",
    props: {},
    children: [42],
  })
})

test("npm deps install and update use a locked package store for one document", async t => {
  const root = await tempRoot(t)
  const bin = join(root, "bin")
  await mkdir(bin)
  const source = `---
matra:
  entry: main.matra
  values: [math.js]
  javascript:
    packages: [matra-test-package]
---
\`\`\`main.matra
p { math.answer }
\`\`\`
\`\`\`math.js
export * from "matra-test-package"
\`\`\`
`
  await writeFile(join(root, "index.md"), source)
  const dependencyRoot = getLiterateDependencyDirectory(root, "index.md", "javascript")
  const npmLog = join(root, "npm-args.json")
  await executable(
    join(bin, "npm"),
    `const fs=require("node:fs"); const path=require("node:path"); const args=process.argv.slice(2);
const root=args[args.indexOf("--prefix")+1];
fs.writeFileSync(process.env.MATRA_TEST_NPM_LOG, JSON.stringify(args));
fs.mkdirSync(path.join(root,"node_modules","matra-test-package"),{recursive:true});
fs.writeFileSync(path.join(root,"node_modules","matra-test-package","package.json"),JSON.stringify({name:"matra-test-package",type:"module",exports:"./index.js"}));
fs.writeFileSync(path.join(root,"node_modules","matra-test-package","index.js"),"export const answer=42");
fs.writeFileSync(path.join(root,"package-lock.json"),JSON.stringify({lockfileVersion:3,packages:{}}));`,
  )
  const result = spawnSync(process.execPath, [cli, "deps", "install", "npm", "index.md", "--yes"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: bin, MATRA_TEST_NPM_LOG: npmLog },
  })
  assert.equal(result.status, 0, result.stderr)
  const args = JSON.parse(await readFile(npmLog, "utf8"))
  assert.deepEqual(args.slice(0, 2), ["install", "--prefix"])
  assert.ok(args.includes("--ignore-scripts"))
  assert.deepEqual(JSON.parse(await readFile(join(dependencyRoot, "package.json"), "utf8")), {
    private: true,
    type: "module",
    dependencies: { "matra-test-package": "*" },
  })
  assert.ok((await readFile(join(dependencyRoot, "package-lock.json"), "utf8")).length > 0)
  const bundle = await buildLiterate(source, { document: "index.md", moduleRoot: root })
  assert.deepEqual(await runLiterate(bundle, { moduleRoot: root }), {
    tag: "p",
    props: {},
    children: [42],
  })
  const updated = spawnSync(process.execPath, [cli, "deps", "update", "npm", "index.md", "--yes"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: bin, MATRA_TEST_NPM_LOG: npmLog },
  })
  assert.equal(updated.status, 0, updated.stderr)
  assert.equal(JSON.parse(await readFile(npmLog, "utf8"))[0], "update")
})

test("npm deps install does not execute commands without an explicit confirmation", async t => {
  const root = await tempRoot(t)
  const marker = join(root, "unexpected")
  await writeFile(
    join(root, "index.md"),
    `---
matra:
  entry: main.matra
  values: [main.js]
  javascript:
    packages: [left-pad]
---
`,
  )
  const bin = join(root, "bin")
  await mkdir(bin)
  await executable(
    join(bin, "npm"),
    `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran");`,
  )
  const result = spawnSync(process.execPath, [cli, "deps", "install", "npm", "index.md"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: bin },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /rerun with --yes/)
  await assert.rejects(readFile(marker), { code: "ENOENT" })
})

test("Python deps install honors its lock and update explicitly resolves packages again", async t => {
  const root = await tempRoot(t)
  const bin = join(root, "bin")
  await mkdir(bin)
  const pythonRoot = getLiterateDependencyDirectory(root, "index.md", "python")
  await writeFile(
    join(root, "index.md"),
    `---
matra:
  entry: main.matra
  values: [value.py]
  python:
    packages: [sample-wheel]
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
  const wheel2 = wheelZip({
    "sample_pkg/__init__.py": "answer = 42\n",
    "sample_wheel-2.0.dist-info/METADATA":
      "Metadata-Version: 2.1\nName: sample-wheel\nVersion: 2.0\n\n",
    "sample_wheel-2.0.dist-info/WHEEL":
      "Wheel-Version: 1.0\nGenerator: test\nRoot-Is-Purelib: true\nTag: py3-none-any\n\n",
  })
  const wheel1 = wheelZip({
    "sample_pkg/__init__.py": "answer = 21\n",
    "sample_wheel-1.0.dist-info/METADATA":
      "Metadata-Version: 2.1\nName: sample-wheel\nVersion: 1.0\n\n",
    "sample_wheel-1.0.dist-info/WHEEL":
      "Wheel-Version: 1.0\nGenerator: test\nRoot-Is-Purelib: true\nTag: py3-none-any\n\n",
  })
  await mkdir(join(pythonRoot, "wheels"), { recursive: true })
  await writeFile(join(pythonRoot, "wheels/sample_wheel-2.0-py3-none-any.whl"), wheel2)
  await writeFile(
    join(pythonRoot, "matra.python.lock.json"),
    JSON.stringify({
      format: "matra-python-wheels-1",
      pyodide: "314.0.7",
      packages: [
        {
          name: "sample-wheel",
          version: "2.0",
          file: "wheels/sample_wheel-2.0-py3-none-any.whl",
          sha256: createHash("sha256").update(wheel2).digest("hex"),
        },
      ],
    }),
  )
  const pipLog = join(root, "pip-args.jsonl")
  await executable(
    join(bin, "python3"),
    `const fs=require("node:fs"); const path=require("node:path"); const args=process.argv.slice(2);
fs.appendFileSync(process.env.MATRA_TEST_PIP_LOG, JSON.stringify(args)+"\\n");
const locked=args.includes("--constraint");
const filename=locked?"sample_wheel-2.0-py3-none-any.whl":"sample_wheel-1.0-py3-none-any.whl";
const contents=locked?${JSON.stringify(wheel2.toString("base64"))}:${JSON.stringify(wheel1.toString("base64"))};
fs.writeFileSync(path.join(args[args.indexOf("--dest")+1], filename), Buffer.from(contents, "base64"));`,
  )
  const env = {
    ...process.env,
    PATH: bin,
    MATRA_PYTHON: join(bin, "python3"),
    MATRA_TEST_PIP_LOG: pipLog,
  }
  const installed = spawnSync(
    process.execPath,
    [cli, "deps", "install", "python", "index.md", "--yes"],
    { cwd: root, encoding: "utf8", env },
  )
  assert.equal(installed.status, 0, installed.stderr)
  assert.equal(
    JSON.parse(await readFile(join(pythonRoot, "matra.python.lock.json"), "utf8")).packages[0]
      .version,
    "2.0",
  )
  const updated = spawnSync(
    process.execPath,
    [cli, "deps", "update", "python", "index.md", "--yes"],
    { cwd: root, encoding: "utf8", env },
  )
  assert.equal(updated.status, 0, updated.stderr)
  assert.equal(
    JSON.parse(await readFile(join(pythonRoot, "matra.python.lock.json"), "utf8")).packages[0]
      .version,
    "1.0",
  )
  const args = (await readFile(pipLog, "utf8"))
    .trim()
    .split("\n")
    .map(line => JSON.parse(line))
  assert.ok(args[0].includes("--constraint"))
  assert.ok(!args[1].includes("--constraint"))
})
