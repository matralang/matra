/** Recursive subset of MathJSON represented by Matra Math. */
export type MathJsonScalar = number | string | boolean | null
export type MathJson = MathJsonScalar | MathJsonFunction

/** A MathJSON function has a string head followed by zero or more operands. */
export interface MathJsonFunction extends Array<MathJson> {
  0: string
}

export interface MorphionTerm {
  key: number[]
  coeff: MathJson
}

export interface MorphionForm {
  head: "MorphionForm"
  attributes: {
    bases: MathJson[]
    terms: MorphionTerm[]
  }
}

export type ContentMathMLExpression =
  | ContentMathMLIdentifier
  | ContentMathMLNumber
  | ContentMathMLSymbol
  | ContentMathMLApplication

export interface ContentMathMLIdentifier {
  kind: "identifier"
  name: string
}

export interface ContentMathMLNumber {
  kind: "number"
  type: "integer" | "real" | "double"
  value: string
}

export interface ContentMathMLSymbol {
  kind: "symbol"
  cdbase: string
  cd: string
  name: string
}

export interface ContentMathMLApplication {
  kind: "application"
  operator: ContentMathMLExpression
  operands: ContentMathMLExpression[]
}

export type MathExpression = MathJson | MathObjectForm
export type MathExpressionList = MathExpression | MathExpression[]

export type MathObjectForm = {
  base?: MathExpression

  // structured numeric literals
  re?: MathExpression
  im?: MathExpression
  rational?: [MathExpression, MathExpression]

  // elementary functions
  sin?: MathExpression
  cos?: MathExpression
  tan?: MathExpression
  exp?: MathExpression
  log?: MathExpression
  abs?: MathExpression

  // EML primitive
  eml?: [MathExpression, MathExpression]

  // operation layers
  power?: MathExpression
  root?: MathExpression
  times?: MathExpressionList
  divide?: MathExpressionList
  plus?: MathExpressionList
  minus?: MathExpressionList
}
