import { unwatchFile, watchFile } from "node:fs"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { join, resolve } from "node:path"
import { buildProject } from "./project.mjs"

const assets = [
  ["index.html", "text/html; charset=utf-8"],
  ["matra.css", "text/css; charset=utf-8"],
  ["matra.css.LICENSE", "text/plain; charset=utf-8"],
]

export async function startDev(
  directory,
  { port = 3000, onBuild = console.log, onError = console.error } = {},
) {
  const root = resolve(directory)
  let snapshot
  let failure
  let timer
  let building
  let pending = false
  let closed = false

  async function refresh() {
    const output = await buildProject(root)
    const entries = await Promise.all(
      assets.map(async ([name, type]) => [
        `/${name}`,
        { type, body: await readFile(join(root, "dist", name)) },
      ]),
    )
    snapshot = new Map(entries)
    failure = undefined
    onBuild(`Generated: ${output}`)
  }

  async function rebuild() {
    pending = false
    try {
      await refresh()
    } catch (error) {
      failure = `${error.code ? `${error.code}: ` : ""}${error.message}`
      onError(`Build failed: ${failure}\nWaiting for changes.`)
    }
  }

  function schedule() {
    if (closed) return
    pending = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (building) return
      building = rebuild().finally(() => {
        building = undefined
        if (pending && !closed) schedule()
      })
    }, 100)
  }

  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store")
    response.setHeader("X-Content-Type-Options", "nosniff")
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" })
      response.end()
      return
    }
    const path = request.url.split("?")[0]
    const asset = snapshot?.get(path === "/" ? "/index.html" : path)
    const status = !asset ? 404 : failure ? 503 : 200
    const body = !asset ? "Not found\n" : failure ? `Build failed: ${failure}\n` : asset.body
    response.writeHead(status, {
      "Content-Type": status === 200 ? asset.type : "text/plain; charset=utf-8",
    })
    response.end(request.method === "HEAD" ? undefined : body)
  })

  const watched = ["index.md", "matra.css", "matra.css.LICENSE"].map(name => join(root, name))
  for (const path of watched) watchFile(path, { interval: 200 }, schedule)

  async function close() {
    closed = true
    clearTimeout(timer)
    for (const path of watched) unwatchFile(path, schedule)
    if (building) await building
    if (server.listening) {
      await new Promise((resolveClose, reject) => {
        server.close(error => (error ? reject(error) : resolveClose()))
        server.closeAllConnections()
      })
    }
  }

  try {
    building = refresh()
    try {
      await building
    } finally {
      building = undefined
    }
    if (pending) schedule()
    await new Promise((resolveListen, reject) => {
      server.once("error", reject)
      server.listen(port, "127.0.0.1", () => {
        server.removeListener("error", reject)
        resolveListen()
      })
    })
  } catch (error) {
    await close()
    throw error
  }
  server.on("error", onError)
  return { url: `http://127.0.0.1:${server.address().port}/`, close }
}
