import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { build } from "esbuild"

const core = fileURLToPath(new URL("..", import.meta.url))
const outdir = resolve(core, ".browser-size-test")

test("async browser entry keeps the initial bundle and tokenizer chunk within their budgets", async () => {
  const result = await build({
    stdin: {
      contents: `
        import { parse, evaluate, staticValueToAST } from "@matra/core/browser-async"
        export async function render(source) {
          return staticValueToAST(evaluate(await parse(source)))
        }
      `,
      resolveDir: core,
      sourcefile: "demo.js",
    },
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "es2022",
    minify: true,
    splitting: true,
    outdir,
    write: false,
    metafile: true,
    logLevel: "silent",
  })

  const outputs = Object.entries(result.metafile.outputs)
  const entry = outputs.find(([, metadata]) => metadata.entryPoint?.endsWith("demo.js"))
  assert.ok(entry, "missing entry bundle")
  const collectStatic = roots => {
    const files = new Set()
    const pending = [...roots]
    while (pending.length) {
      const path = pending.pop()
      if (files.has(path)) continue
      const metadata = result.metafile.outputs[path]
      assert.ok(metadata, `missing bundled output: ${path}`)
      files.add(path)
      for (const dependency of metadata.imports) {
        assert.ok(!dependency.external, `unexpected external import: ${dependency.path}`)
        if (dependency.kind === "import-statement") pending.push(dependency.path)
      }
    }
    return files
  }
  const size = files =>
    [...files].reduce((sum, path) => {
      const output = result.outputFiles.find(file => file.path === resolve(path))
      assert.ok(output, `missing output file: ${path}`)
      return sum + output.contents.byteLength
    }, 0)
  const initial = collectStatic([entry[0]])
  const initialSize = size(initial)
  assert.ok(initialSize <= 32 * 1024, `initial: ${initialSize} bytes`)
  for (const path of initial) {
    assert.ok(
      !Object.keys(result.metafile.outputs[path].inputs).some(input => input.includes("/acorn/")),
    )
  }

  const lazyImport = [...initial]
    .flatMap(path => result.metafile.outputs[path].imports)
    .find(item => item.kind === "dynamic-import")
  assert.ok(lazyImport, "missing tokenizer dynamic import")
  const lazy = new Set(outputs.map(([path]) => path).filter(path => !initial.has(path)))
  assert.ok(lazy.has(lazyImport.path), "dynamic import must reference a separate bundle")
  const lazySize = size(lazy)
  assert.ok(lazySize <= 128 * 1024, `tokenizer: ${lazySize} bytes`)
  assert.ok(
    [...lazy].some(path =>
      Object.keys(result.metafile.outputs[path].inputs).some(input => input.includes("/acorn/")),
    ),
    "tokenizer chunk must contain Acorn",
  )
  console.log(
    `browser bundle: initial ${initialSize} bytes; tokenizer ${lazySize} bytes; total ${size(new Set(outputs.map(([path]) => path)))} bytes`,
  )

  const directory = await mkdtemp(join(tmpdir(), "matra-browser-bundle-"))
  try {
    await writeFile(join(directory, "package.json"), '{"type":"module"}')
    const unavailable = join(directory, "unavailable")
    await mkdir(unavailable)
    for (const path of initial) {
      const file = result.outputFiles.find(output => output.path === resolve(path))
      assert.ok(file, `missing output file: ${path}`)
      await writeFile(join(unavailable, basename(file.path)), file.contents)
    }
    const withoutTokenizer = await import(pathToFileURL(join(unavailable, basename(entry[0]))).href)
    assert.equal((await withoutTokenizer.render('p { "Hello" }')).tag, "p")
    await assert.rejects(withoutTokenizer.render('nodejs(bind="x") { return 1; }'), {
      code: "ERR_MODULE_NOT_FOUND",
    })

    for (const file of result.outputFiles) {
      await writeFile(join(directory, basename(file.path)), file.contents)
    }
    const { render } = await import(pathToFileURL(join(directory, basename(entry[0]))).href)
    assert.deepEqual(await render('p { "Hello" }'), {
      tag: "p",
      props: {},
      children: ["Hello"],
    })
    assert.deepEqual(await render('nodejs(bind="x") { return { text: "}" }; }'), {
      tag: "nodejs",
      props: { bind: "x" },
      children: [' return { text: "}" }; '],
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
