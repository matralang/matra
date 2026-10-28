import { writeFile } from "node:fs/promises"
import { CommandError } from "./bootstrap-compiler.mjs"
import { buildLiterate, LiterateError, runLiterate } from "./literate-runtime.mjs"
import { createNodeRuntime, PortableRuntimeError, projectPath } from "./node-runtime.mjs"

const args = process.argv.slice(2)
if (args[0] === "--") args.shift()
const [command, root, input, ...rest] = args

try {
  if (!root || !input) throw new Error("Missing project root or input")
  const runtime = createNodeRuntime({ root })
  if (command === "build" && rest.length === 1) {
    const [output] = rest
    const outputPath = projectPath(root, output, { write: true })
    if (outputPath === projectPath(root, input)) throw new Error("Output must not overwrite source")
    const bundle = await buildLiterate(runtime.read_text(input), { document: input })
    await writeFile(outputPath, `${JSON.stringify(bundle)}\n`, "utf8")
  } else if (command === "run" && rest.length === 0) {
    const result = await runLiterate(JSON.parse(runtime.read_text(input)))
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } else {
    throw new Error(
      "Usage: pnpm literate -- build ROOT DOCUMENT.md OUTPUT.json\n" +
        "       pnpm literate -- run ROOT OUTPUT.json",
    )
  }
} catch (error) {
  if (error instanceof CommandError) {
    process.stderr.write(error.stderr)
    process.exitCode = error.exitCode
  } else {
    const code =
      error instanceof LiterateError || error instanceof PortableRuntimeError
        ? `${error.code}: `
        : ""
    console.error(`${code}${error instanceof Error ? error.message : String(error)}`)
    if (error.cause?.stack) console.error(error.cause.stack)
    process.exitCode = 1
  }
}
