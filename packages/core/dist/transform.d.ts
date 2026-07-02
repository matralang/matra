import type { MatraAST } from "./types.js";
export interface VisitContext {
    parent: MatraAST | null;
    index: number | null;
}
export type Visitor = (node: MatraAST, context: VisitContext) => void;
export type Transformer = (node: MatraAST, context: VisitContext) => MatraAST | null | undefined;
/** Depth-first traversal of AST nodes. Literal children are left untouched. */
export declare function visit(node: MatraAST, visitor: Visitor): void;
/** Immutable bottom-up transformation. Returning null removes an AST child. */
export declare function transform(node: MatraAST, transformer: Transformer): MatraAST | null;
