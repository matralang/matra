import assert from "node:assert/strict"
import { test } from "node:test"

import { executeMatraProgram } from "../src/matra-program.js"

test("executes matra.raw() in a .matra.ts template", () => {
  const program = [
    'const dots = ["circle(cx=10)", "circle(cx=20)"]',
    'export default matra`svg { ${matra.raw(dots.join("\\n"))} }`',
  ].join("\n")

  assert.equal(
    executeMatraProgram(program),
    "svg { circle(cx=10)\ncircle(cx=20) }",
  )
})

test("allows escaped interpolation syntax in Matra text", () => {
  const program = `export default matra\`p { "Write \\\${...} to interpolate a value." }\``

  assert.equal(
    executeMatraProgram(program),
    'p { "Write ${...} to interpolate a value." }',
  )
})
