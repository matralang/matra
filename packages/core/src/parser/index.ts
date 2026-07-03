import { isMatraAST, isMatraJSON, matraJSONToAST } from "../ast/convert.js"
import type { MatraAST, MatraParser, ParseOptions } from "../ast/types.js"
import { parse as peggyParse } from "./generated.mjs"
import { normalizeSyntaxError } from "./error.js"

/** Parse source with the bundled Peggy implementation. */
export function parse(source: string, options?: ParseOptions): MatraAST {
  try {
    return normalizeParserOutput(peggyParse(source, options))
  } catch (error) {
    throw normalizeSyntaxError(error, source, options?.sourceId)
  }
}

/**
 * Run any compatible parser and normalize its output to Matra AST.
 * Parsers may return either MatraJSON or an already normalized AST.
 */
export function parseWith(
  parser: MatraParser<unknown>,
  source: string,
  options?: ParseOptions,
): MatraAST {
  try {
    return normalizeParserOutput(parser.parse(source, options))
  } catch (error) {
    throw normalizeSyntaxError(error, source, options?.sourceId)
  }
}

function normalizeParserOutput(output: unknown): MatraAST {
  if (isMatraAST(output)) return output
  if (isMatraJSON(output)) return matraJSONToAST(output)
  throw new TypeError("Parser output must be a Matra AST or MatraJSON node")
}
