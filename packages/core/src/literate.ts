import { buildLiterate as build, runLiterate as run } from "./literate/runtime.mjs"
import type { StaticValue } from "./program.js"

export { LiterateError } from "./literate/runtime.mjs"

export interface LiterateBuildOptions {
  document?: string
}

export interface LiterateBlock {
  document: string
  path: string
  source: string
  line: number
}

export interface LiterateBundle {
  format: "matra-literate-1"
  abi: "matra-value-1"
  entry: LiterateBlock
  values: LiterateBlock[]
  modules?: LiterateBlock[]
  wasm: string
}

export interface LiterateRunOptions {
  globals?: Record<string, StaticValue>
  moduleRoot?: string
}

export async function buildLiterate(
  markdown: string,
  options: LiterateBuildOptions = {},
): Promise<LiterateBundle> {
  return build(markdown, options)
}

export async function runLiterate(
  bundle: LiterateBundle,
  options: LiterateRunOptions = {},
): Promise<StaticValue> {
  return run(bundle, options)
}
