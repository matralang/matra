import assert from "node:assert/strict"
import { spawnSync as spawn } from "node:child_process"

export function spawnSync(command, args, options = {}) {
  const result = spawn(command, args, {
    timeout: 120000,
    ...options,
    killSignal: "SIGKILL",
  })
  const description = `Subprocess failed: ${command} ${args.join(" ")}`
  assert.ifError(
    result.error
      ? new Error(`${description}: ${result.error.message}`, { cause: result.error })
      : null,
  )
  assert.equal(result.signal, null, `${description}: terminated by ${result.signal}`)
  return result
}
