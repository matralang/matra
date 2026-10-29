/** @matra/core — domain-neutral Matra tree primitives. */
export { astToMatraJSON, isMatraAST, isMatraJSON, matraJSONToAST, } from "./ast/convert.js";
export { evaluatePropExpressions } from "./ast/evaluate.js";
export { astToMorphion, morphionToAST } from "./ast/morphion.js";
export { transform, visit } from "./ast/transform.js";
export { CORE_VERSION, SPEC_VERSION } from "./ast/types.js";
export { loadMatra, matra, normalizeMatra } from "./jsonmatra.js";
export { extractMarkdownFences, extractMatraMarkdown } from "./markdown.js";
export { formatCodeFrame, MatraSyntaxError } from "./parser/error.js";
export { parse } from "./parser/index.js";
export { printJSON } from "./printer.js";
export { EvaluationRequiredError, evaluate, evaluateStatic, ProgramSyntaxError, staticValueToAST, } from "./program.js";
export { renderWith } from "./render.js";
export { evaluateStandard, evaluateStandardProps, mapValues as Map, Range, } from "./standard.js";
import { astToMatraJSON, matraJSONToAST } from "./ast/convert.js";
import { evaluatePropExpressions } from "./ast/evaluate.js";
import { astToMorphion, morphionToAST } from "./ast/morphion.js";
import { transform, visit } from "./ast/transform.js";
import { CORE_VERSION } from "./ast/types.js";
import { loadMatra, matra, normalizeMatra } from "./jsonmatra.js";
import { extractMarkdownFences, extractMatraMarkdown } from "./markdown.js";
import { parse } from "./parser/index.js";
import { printJSON } from "./printer.js";
import { renderWith } from "./render.js";
import { evaluateStandard, evaluateStandardProps, mapValues, Range } from "./standard.js";
export const VERSION = CORE_VERSION;
export default {
    parse,
    astToMatraJSON,
    matraJSONToAST,
    astToMorphion,
    morphionToAST,
    printJSON,
    extractMarkdownFences,
    extractMatraMarkdown,
    transform,
    visit,
    evaluatePropExpressions,
    renderWith,
    evaluateStandard,
    evaluateStandardProps,
    loadMatra,
    normalizeMatra,
    matra,
    Map: mapValues,
    Range,
    VERSION,
};
//# sourceMappingURL=index.js.map