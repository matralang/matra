// @ts-ignore: allow importing Node modules without @types/node installed
import { spawn } from "node:child_process"
// @ts-ignore: allow importing Node modules without @types/node installed
import { watch } from "node:fs"
// @ts-ignore: allow importing Node modules without @types/node installed
import { resolve } from "node:path"

declare const process: any

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const sourceDirectory = resolve(process.cwd(), "src")
let building = false
let pending = false
let debounce: ReturnType<typeof setTimeout> | undefined

function run(args: string[]): Promise<number> {
  return new Promise(resolveExit => {
    const child = spawn(command, args, { stdio: "inherit" })
    child.on("exit", (code: number | null) => resolveExit(code ?? 1))
  })
}

async function rebuild() {
  if (building) {
    pending = true
    return
  }

  building = true
  const code = await run(["run", "build"])
  building = false
  if (code !== 0) console.error("Website build failed; waiting for the next change.")

  if (pending) {
    pending = false
    void rebuild()
  }
}

function scheduleRebuild() {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => void rebuild(), 100)
}

const initialCode = await run(["run", "build"])
if (initialCode !== 0) process.exit(initialCode)

const server = spawn(command, ["exec", "serve", "dist", "--listen", "3000"], { stdio: "inherit" })
const watcher = watch(sourceDirectory, { recursive: true }, (_event, filename) => {
  if (filename && !filename.endsWith("~")) scheduleRebuild()
})

function stop() {
  watcher.close()
  server.kill()
  process.exit()
}

process.on("SIGINT", stop)
process.on("SIGTERM", stop)
