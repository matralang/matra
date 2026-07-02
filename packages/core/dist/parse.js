import { isMatraAST, isMatraJSON, matraJSONToAST } from "./convert.js";
import { parse as peggyParse } from "./matra-parser.mjs";
/** Parse source with the bundled Peggy implementation. */
export function parse(source, options) {
    return normalizeParserOutput(peggyParse(source, options));
}
/**
 * Run any compatible parser and normalize its output to Matra AST.
 * Parsers may return either MatraJSON or an already normalized AST.
 */
export function parseWith(parser, source, options) {
    return normalizeParserOutput(parser.parse(source, options));
}
function normalizeParserOutput(output) {
    if (isMatraAST(output))
        return output;
    if (isMatraJSON(output))
        return matraJSONToAST(output);
    throw new TypeError("Parser output must be a Matra AST or MatraJSON node");
}
//# sourceMappingURL=parse.js.map