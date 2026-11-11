#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { buildSite } from "@matra/site-generation"
import { installDependencies } from "./deps.mjs"
import { startDev } from "./dev.mjs"
import { buildProject, initProject } from "./project.mjs"

const usage = `Usage: matra init DIRECTORY
       matra build
       matra install [DOCUMENT] [--yes]
       matra deps install [DOCUMENT] [--yes]
       matra deps install (npm|python) DOCUMENT [--yes]
       matra deps update (npm|python) DOCUMENT [--yes]
       matra site build
       matra dev [--port PORT]
       matra --version

init   Create a new project directory.
build  Build index.md and matra.css into dist/ in the current directory.
site   Build the configured multi-page site into dist/.
dev    Serve on 127.0.0.1:3000 and rebuild on changes. Refresh the browser to view changes.
deps   Install or update npm/Python packages declared by the selected document.
install  Install both ecosystems (default document: index.md); alias of deps install.

matra build executes selected JavaScript in index.md.
matra site build executes only explicitly named .matra.md pages and layouts.
matra deps install prompts before network access; npm lifecycle scripts are disabled.
Only build trusted programs; execution has no OS sandbox or timeout.`

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
  } else if (
    args[0] === "install" ||
    (args[0] === "deps" && ["install", "update"].includes(args[1]))
  ) {
    const update = args[0] === "deps" && args[1] === "update"
    const operands = args.slice(args[0] === "deps" ? 2 : 1)
    const yes = operands.at(-1) === "--yes"
    if (yes) operands.pop()
    const ecosystem = ["npm", "python"].includes(operands[0]) ? operands.shift() : "all"
    if (
      operands.length > 1 ||
      operands.some(value => !value || value.startsWith("-")) ||
      (ecosystem !== "all" && operands.length !== 1) ||
      (update && ecosystem === "all")
    ) {
      throw new Error(usage)
    }
    await installDependencies(process.cwd(), ecosystem, operands[0] ?? "index.md", yes, update)
  } else if (args[0] === "site" && args[1] === "build" && args.length === 2) {
    const outputs = await buildSite(process.cwd())
    console.log(`Generated ${outputs.length} site file(s)`)
  } else if (
    args[0] === "dev" &&
    (args.length === 1 || (args.length === 3 && args[1] === "--port" && /^[0-9]+$/.test(args[2])))
  ) {
    const port = args.length === 1 ? 3000 : Number(args[2])
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("Port must be an integer between 1 and 65535")
    }
    const dev = await startDev(process.cwd(), { port })
    console.log(`Serving: ${dev.url}\nWatching for changes. Refresh the browser. Ctrl+C to stop.`)
    let stop
    try {
      await new Promise(resolve => {
        stop = resolve
        process.once("SIGINT", stop)
        process.once("SIGTERM", stop)
      })
    } finally {
      process.removeListener("SIGINT", stop)
      process.removeListener("SIGTERM", stop)
      await dev.close()
    }
  } else {
    throw new Error(usage)
  }
} catch (error) {
  console.error(`${error.code ? `${error.code}: ` : ""}${error.message}`)
  process.exitCode = 1
}
