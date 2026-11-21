import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const bin = fileURLToPath(new URL("../src/cli.mjs", import.meta.url))
const run = args => execFileSync(process.execPath, [bin, ...args], { encoding: "utf8" })

test("matraはbinで@matra/cliと同じmatra commandを公開する", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url)))
  assert.equal(pkg.bin.matra, "src/cli.mjs")
  assert.ok(pkg.dependencies["@matra/cli"].startsWith("workspace:"))
})

test("--versionは@matra/cliのversionを報告する", async () => {
  const cli = JSON.parse(
    await readFile(new URL("../node_modules/@matra/cli/package.json", import.meta.url)),
  )
  assert.equal(run(["--version"]).trim(), cli.version)
})

test("--helpはmatraのusageを表示する", () => {
  assert.match(run(["--help"]), /^Usage: matra init DIRECTORY/)
})
