import { isMatraAST, isMatraJSON, matraJSONToAST } from "./convert.js"
import type { MatraAST, MatraParser, ParseOptions } from "./types.js"
import { parse as peggyParse } from "./matra-parser.mjs"

/** Parse source with the bundled Peggy implementation. */
export function parse(source: string, options?: ParseOptions): MatraAST {
  return normalizeParserOutput(peggyParse(source, options))
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
  return normalizeParserOutput(parser.parse(source, options))
}

function normalizeParserOutput(output: unknown): MatraAST {
  if (isMatraAST(output)) return output
  if (isMatraJSON(output)) return matraJSONToAST(output)
  throw new TypeError("Parser output must be a Matra AST or MatraJSON node")
}
