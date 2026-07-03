/** JSON-compatible values shared by AST props and children. */
export type MatraScalar = string | number | boolean | null
export type MatraValue =
  | MatraScalar
  | MatraValue[]
  | { [key: string]: MatraValue }

/** A property may contain an unevaluated expression represented by an AST. */
export type MatraPropValue = MatraValue | MatraAST
export type MatraProps = Record<string, MatraPropValue>

export interface SourcePoint {
  /** Zero-based UTF-16 offset in the source text. */
  offset: number
  /** One-based line number. */
  line: number
  /** One-based column number. */
  column: number
}

export interface SourcePosition {
  start: SourcePoint
  end: SourcePoint
  /** Optional filename, URL, or other source identifier. */
  source?: string
}

/** Object-shaped tree used by Core visitors, transformers, and renderers. */
export interface MatraAST {
  tag: string
  props: MatraProps
  children: MatraASTChild[]
  /** Parser metadata. It is intentionally omitted from MatraJSON. */
  position?: SourcePosition
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
  /** Attach source positions to every parsed AST node. */
  locations?: boolean
  /** Filename, URL, or other identifier copied into source positions. */
  sourceId?: string
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
