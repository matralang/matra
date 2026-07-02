import type { MatraAST, MatraParser, ParseOptions } from "./types.js";
/** Parse source with the bundled Peggy implementation. */
export declare function parse(source: string, options?: ParseOptions): MatraAST;
/**
 * Run any compatible parser and normalize its output to Matra AST.
 * Parsers may return either MatraJSON or an already normalized AST.
 */
export declare function parseWith(parser: MatraParser<unknown>, source: string, options?: ParseOptions): MatraAST;
