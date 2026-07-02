/** @matra/core — domain-neutral Matra tree primitives. */
export { parse, parseWith } from "./parser/index.js";
export { astToMatraJSON, isMatraAST, isMatraJSON, matraJSONToAST, } from "./ast/convert.js";
export { printJSON } from "./printer.js";
export { transform, visit } from "./ast/transform.js";
export { renderWith } from "./render.js";
export type { MatraRenderer } from "./render.js";
export { CORE_VERSION, SPEC_VERSION } from "./ast/types.js";
export type * from "./ast/types.js";
import { parse, parseWith } from "./parser/index.js";
import { astToMatraJSON, matraJSONToAST } from "./ast/convert.js";
import { printJSON } from "./printer.js";
import { transform, visit } from "./ast/transform.js";
import { renderWith } from "./render.js";
export declare const VERSION = "0.2.1";
declare const _default: {
    parse: typeof parse;
    parseWith: typeof parseWith;
    astToMatraJSON: typeof astToMatraJSON;
    matraJSONToAST: typeof matraJSONToAST;
    printJSON: typeof printJSON;
    transform: typeof transform;
    visit: typeof visit;
    renderWith: typeof renderWith;
    VERSION: string;
};
export default _default;
