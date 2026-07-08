/** @matra/core — domain-neutral Matra tree primitives. */
export { parse, parseWith } from "./parser/index.js";
export { formatCodeFrame, MatraSyntaxError } from "./parser/error.js";
export { astToMatraJSON, isMatraAST, isMatraJSON, matraJSONToAST, } from "./ast/convert.js";
export { printJSON } from "./printer.js";
export { transform, visit } from "./ast/transform.js";
export { evaluatePropExpressions } from "./ast/evaluate.js";
export { renderWith } from "./render.js";
export { evaluateStandard, evaluateStandardProps, Map, Range } from "./standard.js";
export { loadMatra, matra, normalizeMatra } from "./jsonmatra.js";
export { CORE_VERSION, SPEC_VERSION } from "./ast/types.js";
import { parse, parseWith } from "./parser/index.js";
import { astToMatraJSON, matraJSONToAST } from "./ast/convert.js";
import { printJSON } from "./printer.js";
import { transform, visit } from "./ast/transform.js";
import { evaluatePropExpressions } from "./ast/evaluate.js";
import { renderWith } from "./render.js";
import { evaluateStandard, evaluateStandardProps, Map, Range } from "./standard.js";
import { loadMatra, matra, normalizeMatra } from "./jsonmatra.js";
import { CORE_VERSION } from "./ast/types.js";
export const VERSION = CORE_VERSION;
export default {
    parse,
    parseWith,
    astToMatraJSON,
    matraJSONToAST,
    printJSON,
    transform,
    visit,
    evaluatePropExpressions,
    renderWith,
    evaluateStandard,
    evaluateStandardProps,
    loadMatra,
    normalizeMatra,
    matra,
    Map,
    Range,
    VERSION,
};
//# sourceMappingURL=index.js.map