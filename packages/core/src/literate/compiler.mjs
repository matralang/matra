import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

export const LITERATE_ABI = "matra-value-1"

export async function loadCompiler() {
  const [bytes, manifest] = await Promise.all([
    readFile(new URL("./compiler.wasm", import.meta.url)),
    readFile(new URL("./compiler.json", import.meta.url), "utf8").then(JSON.parse),
  ])
  if (manifest.abi !== LITERATE_ABI) throw new Error("Bundled compiler ABI is not supported")
  if (createHash("sha256").update(bytes).digest("hex") !== manifest.sha256)
    throw new Error("Bundled compiler checksum mismatch")
  const result = await WebAssembly.instantiate(bytes)
  const exports = result.instance.exports
  if (
    !(exports.memory instanceof WebAssembly.Memory) ||
    !["alloc", "compile", "workspace_pages"].every(name => typeof exports[name] === "function")
  ) {
    throw new Error("Bundled compiler exports are not supported")
  }
  return result
}
