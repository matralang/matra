import type { MatraAST, MatraASTChild } from "@matra/core";
export interface HTMLOptions {
    /** Render the domain-neutral $root tag as a fragment. */
    rootTag?: string;
}
/** Render a Matra AST using HTML semantics. */
export declare function toHTML(ast: MatraAST | MatraASTChild[], options?: HTMLOptions): string;
declare const _default: {
    toHTML: typeof toHTML;
};
export default _default;
