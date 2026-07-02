/** Recursive subset of MathJSON represented by Matra Math. */
export type MathJsonScalar = number | string | boolean | null
export type MathJson = MathJsonScalar | MathJsonFunction

/** A MathJSON function has a string head followed by zero or more operands. */
export interface MathJsonFunction extends Array<MathJson> {
  0: string
}
