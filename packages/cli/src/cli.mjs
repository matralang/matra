#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { startDev } from "./dev.mjs"
import { buildProject, initProject } from "./project.mjs"

const usage = `Usage: matra init DIRECTORY
       matra build
       matra dev [--port PORT]
       matra --version

init   Create a new project directory.
build  Build index.md and matra.css into dist/ in the current directory.
dev    Serve on 127.0.0.1:3000 and rebuild on changes. Refresh the browser to view changes.

Only build trusted documents: JavaScript in the document is executed.`

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
