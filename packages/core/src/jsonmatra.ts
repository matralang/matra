import { readFile } from "node:fs/promises"
import { extname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { isMatraAST, isMatraJSON, matraJSONToAST } from "./ast/convert.js"
import type { SourcePosition } from "./ast/types.js"

export type JSONMatraPrimitive =
  | string
  | number
  | boolean
  | null
  | bigint
  | undefined

export type MatraDocumentSource = {
  kind: "MatraDocumentSource"
  source: string
}

export type MatraExpressionSource = {
  kind: "MatraExpressionSource"
  source: string
}

export interface JSONMatraNode {
  tag: string
  props: Record<string, JSONMatraValue>
  children: JSONMatraValue[]
  position?: SourcePosition
}

export type JSONMatraValue =
  | JSONMatraPrimitive
  | JSONMatraValue[]
  | { [key: string]: JSONMatraValue }
  | JSONMatraNode
  | MatraDocumentSource
  | MatraExpressionSource

type TemplateInput = TemplateStringsArray | string

export async function loadMatra(path: string): Promise<JSONMatraValue> {
  if (path.endsWith(".matra.json")) {
    return normalizeMatra(JSON.parse(await readFile(path, "utf8")))
  }

  if (path.endsWith(".matra.js")) {
    const moduleUrl = pathToFileURL(resolve(path)).href
    const module = await import(moduleUrl)
    if (!("default" in module)) {
      throw new Error(`Matra module must have a default export: ${path}`)
    }
    return normalizeMatra(module.default)
  }

  if (path.endsWith(".jsonm")) {
    return normalizeMatra(parseJSONMSource(await readFile(path, "utf8"), path))
  }

  throw new Error(
    `Unsupported Matra file extension: ${extname(path) || "(none)"}`,
  )
}

export function normalizeMatra(input: unknown): JSONMatraValue {
  if (isMatraAST(input)) {
    return {
      ...input,
      props: normalizeObject(input.props),
      children: input.children.map(child => normalizeMatra(child)),
    }
  }

  if (isMatraJSON(input)) {
    return normalizeMatra(matraJSONToAST(input))
  }

  if (isSourceNode(input)) {
    return { kind: input.kind, source: input.source }
  }

  if (Array.isArray(input)) {
    return input.map(item => normalizeMatra(item))
  }

  if (isRecord(input)) {
    if (typeof input.tag === "string") {
      return {
        tag: input.tag,
        props: isRecord(input.props) ? normalizeObject(input.props) : {},
        children: Array.isArray(input.children)
          ? input.children.map(child => normalizeMatra(child))
          : [],
      }
    }

    return normalizeObject(input)
  }

  if (
    input === null ||
    input === undefined ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean" ||
    typeof input === "bigint"
  ) {
    return input as JSONMatraPrimitive
  }

  throw new TypeError(`Unsupported Matra value: ${typeof input}`)
}

export interface MatraFactory {
  (input: unknown): JSONMatraValue
  doc(strings: TemplateInput, ...values: unknown[]): MatraDocumentSource
  expr(strings: TemplateInput, ...values: unknown[]): MatraExpressionSource
  ast(input: unknown): JSONMatraValue
  tuple(tag: string, props?: unknown, children?: unknown[]): JSONMatraNode
}

export const matra: MatraFactory = Object.assign(
  (input: unknown) => normalizeMatra(input),
  {
    doc(strings: TemplateInput, ...values: unknown[]): MatraDocumentSource {
      return { kind: "MatraDocumentSource", source: templateSource(strings, values) }
    },

    expr(strings: TemplateInput, ...values: unknown[]): MatraExpressionSource {
      return { kind: "MatraExpressionSource", source: templateSource(strings, values) }
    },

    ast(input: unknown): JSONMatraValue {
      return normalizeMatra(input)
    },

    tuple(tag: string, props: unknown = {}, children: unknown[] = []): JSONMatraNode {
      return normalizeMatra([tag, props, children]) as JSONMatraNode
    },
  },
)

function parseJSONMSource(source: string, path: string): JSONMatraValue {
  const doc = parseTaggedSource(source, "doc")
  if (doc !== undefined) return matra.doc(doc)

  const expr = parseTaggedSource(source, "expr")
  if (expr !== undefined) return matra.expr(expr)

  throw new Error(
    `.jsonm parsing is not implemented for this syntax: ${path}. ` +
      "Only matra.doc`...` and matra.expr`...` placeholders are supported.",
  )
}

function parseTaggedSource(source: string, tag: "doc" | "expr"): string | undefined {
  const match = source.match(
    new RegExp(`^\\s*matra\\.${tag}\\s*\`([\\s\\S]*)\`\\s*;?\\s*$`),
  )
  return match?.[1]
}

function templateSource(strings: TemplateInput, values: unknown[]): string {
  if (typeof strings === "string") return strings
  return strings.reduce((source, chunk, index) => {
    const value = index < values.length ? String(values[index]) : ""
    return source + chunk + value
  }, "")
}

function normalizeObject(input: Record<string, unknown>): Record<string, JSONMatraValue> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, normalizeMatra(value)]),
  )
}

function isSourceNode(
  input: unknown,
): input is MatraDocumentSource | MatraExpressionSource {
  return (
    isRecord(input) &&
    (input.kind === "MatraDocumentSource" ||
      input.kind === "MatraExpressionSource") &&
    typeof input.source === "string"
  )
}

function isRecord(input: unknown): input is Record<string, any> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
}
