/** @matra/core — domain-neutral Matra tree primitives. */
export { parse, parseWith } from "./parse.js";
export { astToMatraJSON, isMatraAST, isMatraJSON, matraJSONToAST, } from "./convert.js";
export { printJSON } from "./printer.js";
export { transform, visit } from "./transform.js";
export { renderWith } from "./render.js";
export type { MatraRenderer } from "./render.js";
export { MATRA_VERSION } from "./types.js";
export type * from "./types.js";
import { parse, parseWith } from "./parse.js";
import { astToMatraJSON, matraJSONToAST } from "./convert.js";
import { printJSON } from "./printer.js";
import { transform, visit } from "./transform.js";
import { renderWith } from "./render.js";
export declare const VERSION = "0.2.0";
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
