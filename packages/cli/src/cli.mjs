#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { buildProject, initProject } from "./project.mjs"

const usage = `Usage: matra init DIRECTORY
       matra build
       matra --version

init   Create a new project directory.
build  Build index.md and matra.css into dist/ in the current directory.

Only build trusted documents: JavaScript in the document is executed.
dev is not implemented yet.`

const args = process.argv.slice(2)
if (args[0] === "--") args.shift()

try {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    console.log(usage)
  } else if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
    const { version } = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    )
    console.log(version)
  } else if (args[0] === "init" && args.length === 2 && !args[1].startsWith("-")) {
    const root = await initProject(args[1])
    console.log(`Created: ${root}\nNext: cd ${JSON.stringify(args[1])}\n      matra build`)
  } else if (args[0] === "build" && args.length === 1) {
    const output = await buildProject(process.cwd())
    console.log(`Generated: ${output}`)
  } else {
    throw new Error(usage)
  }
} catch (error) {
  console.error(`${error.code ? `${error.code}: ` : ""}${error.message}`)
  process.exitCode = 1
}
