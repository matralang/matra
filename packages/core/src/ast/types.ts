/** JSON-compatible values shared by AST props and children. */
export type MatraScalar = string | number | boolean | null
export type MatraValue =
  | MatraScalar
  | MatraValue[]
  | { [key: string]: MatraValue }

/** A property may contain an unevaluated expression represented by an AST. */
export type MatraPropValue = MatraValue | MatraAST
export type MatraProps = Record<string, MatraPropValue>

/** Object-shaped tree used by Core visitors, transformers, and renderers. */
export interface MatraAST {
  tag: string
  props: MatraProps
  children: MatraASTChild[]
}

export type MatraASTChild = MatraAST | MatraValue

/** Compact three-element representation used for parser interchange. */
export type MatraJSON = [
  tag: string,
  props: MatraJSONProps,
  children: MatraJSONChild[],
]

export type MatraJSONChild = MatraJSON | MatraValue
export type MatraJSONPropValue = MatraValue | MatraJSON
export type MatraJSONProps = Record<string, MatraJSONPropValue>

export interface ParseOptions {
  grammarSource?: string
  syntaxMode?: "mixed" | "document" | "application"
  [key: string]: unknown
}

/** Minimal contract implemented by Peggy and other replaceable parsers. */
export interface MatraParser<Output = MatraAST | MatraJSON> {
  parse(source: string, options?: ParseOptions): Output
}

/** Version of the @matra/core package API. */
export const CORE_VERSION = "0.2.1"

/** Version of the Matra language specification implemented by this release. */
export const SPEC_VERSION = "0.2"
