import assert from "node:assert/strict"
import { test } from "node:test"
import { spawnSync } from "./helpers/process.mjs"

test("test subprocess helper returns success and nonzero diagnostics", () => {
  const success = spawnSync(process.execPath, ["-e", 'console.log("done")'], { encoding: "utf8" })
  assert.equal(success.status, 0)
  assert.equal(success.stdout, "done\n")
  const failure = spawnSync(process.execPath, ["-e", 'console.error("failed"); process.exit(2)'], {
    encoding: "utf8",
  })
  assert.equal(failure.status, 2)
  assert.equal(failure.stderr, "failed\n")
})

test("test subprocess helper terminates a stalled process and reports timeout", () => {
  assert.throws(
    () => spawnSync(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeout: 200 }),
    /Subprocess failed: .*ETIMEDOUT/,
  )
})

test("test subprocess helper reports missing executable", () => {
  assert.throws(() => spawnSync("matra-nonexistent-test-executable", []), /ENOENT/)
})
