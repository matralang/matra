import {
  buildLiterate as build,
  getLiterateDependencyDirectory as getDependencyDirectory,
  getPythonPackageTarget as getPythonTarget,
  readLiteratePackages as readPackageNames,
  readPythonPackages as readPythonPackageNames,
  runLiterate as run,
  validatePythonWheels as validatePythonWheelFiles,
} from "./literate/runtime.mjs"
import type { StaticValue } from "./program.js"

export { LiterateError } from "./literate/runtime.mjs"

export interface LiterateBuildOptions {
  document?: string
  moduleRoot?: string
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
  pythonModules?: LiterateBlock[]
  pythonPackages?: Array<{
    name: string
    version: string
    file: string
    sha256: string
  }>
  wasm: string
}

export interface LiterateRunOptions {
  globals?: Record<string, StaticValue>
  moduleRoot?: string
}

export interface LiteratePythonWheel {
  name: string
  version: string
  file: string
  sha256: string
  bytes: Uint8Array
}

export interface LiteratePackages {
  javascript: string[]
  python: string[]
}

export function readLiteratePackages(
  markdown: string,
  options: Pick<LiterateBuildOptions, "document"> = {},
): LiteratePackages {
  return readPackageNames(markdown, options)
}

export function getLiterateDependencyDirectory(
  moduleRoot: string,
  document: string,
  ecosystem: "javascript" | "python",
): string {
  return getDependencyDirectory(moduleRoot, document, ecosystem)
}

export function readPythonPackages(
  markdown: string,
  options: Pick<LiterateBuildOptions, "document"> = {},
): string[] {
  return readPythonPackageNames(markdown, options)
}

export function getPythonPackageTarget(): { pyodide: string; python: string } {
  return getPythonTarget()
}

export async function validatePythonWheels(
  packages: LiteratePythonWheel[],
  document?: string,
): Promise<void> {
  return validatePythonWheelFiles(packages, document)
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
