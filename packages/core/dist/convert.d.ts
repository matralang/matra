import type { MatraAST, MatraJSON } from "./types.js";
export declare function isMatraAST(value: unknown): value is MatraAST;
export declare function isMatraJSON(value: unknown): value is MatraJSON;
/** Convert the object-shaped AST to compact MatraJSON. */
export declare function astToMatraJSON(ast: MatraAST): MatraJSON;
/** Convert compact MatraJSON to the object-shaped AST. */
export declare function matraJSONToAST(node: MatraJSON): MatraAST;
