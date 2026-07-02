/** JSON-compatible values shared by AST props and children. */
export type MatraScalar = string | number | boolean | null
export type MatraValue =
  | MatraScalar
  | MatraValue[]
  | { [key: string]: MatraValue }

export type MatraProps = Record<string, MatraValue>

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
  props: MatraProps,
  children: MatraJSONChild[],
]

export type MatraJSONChild = MatraJSON | MatraValue

export interface ParseOptions {
  grammarSource?: string
  syntaxMode?: "mixed" | "document" | "application"
  [key: string]: unknown
}

/** Minimal contract implemented by Peggy and other replaceable parsers. */
export interface MatraParser<Output = MatraAST | MatraJSON> {
  parse(source: string, options?: ParseOptions): Output
}

export const MATRA_VERSION = "0.2.0"
