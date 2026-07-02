#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import process from "node:process"
import { MatraKernel } from "../src/kernel.js"

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)

if (args[0] === "install") {
  await install(args.slice(1))
} else {
  const index = args.indexOf("-f") >= 0 ? args.indexOf("-f") : args.indexOf("--connection-file")
  const connectionFile = index >= 0 ? args[index + 1] : args[0]
  if (!connectionFile) usage(1)
  const kernel = await MatraKernel.fromFile(connectionFile)
  const stop = () => kernel.stop()
  process.once("SIGTERM", stop)
  await kernel.start()
}

async function install(options) {
  const prefixIndex = options.indexOf("--prefix")
  let root
  if (prefixIndex >= 0) root = join(options[prefixIndex + 1], "share", "jupyter", "kernels")
  else if (options.includes("--sys-prefix")) root = join(process.prefix, "share", "jupyter", "kernels")
  else if (process.platform === "win32") root = join(process.env.APPDATA, "jupyter", "kernels")
  else if (process.platform === "darwin") root = join(process.env.HOME, "Library", "Jupyter", "kernels")
  else root = join(process.env.XDG_DATA_HOME ?? join(process.env.HOME, ".local", "share"), "jupyter", "kernels")

  const target = join(root, "matra")
  await mkdir(target, { recursive: true })
  const spec = JSON.parse(await readFile(join(here, "..", "kernelspec", "kernel.json"), "utf8"))
  spec.argv[0] = process.execPath
  spec.argv[1] = fileURLToPath(import.meta.url)
  await writeFile(join(target, "kernel.json"), `${JSON.stringify(spec, null, 2)}\n`)
  console.log(`Installed Matra kernelspec in ${target}`)
}

function usage(exitCode) {
  console.error("Usage: matra-kernel -f CONNECTION_FILE\n       matra-kernel install [--user | --sys-prefix | --prefix PATH]")
  process.exit(exitCode)
}
