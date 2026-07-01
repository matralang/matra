/**
 * Transform Matra AST with template context
 * @param {import('./types.mjs').MatraNode} ast
 * @param {Record<string, any>} context
 * @returns {import('./types.mjs').MatraNode}
 */
export function transform(ast: import("./types.mjs").MatraNode, context?: Record<string, any>): import("./types.mjs").MatraNode;
declare namespace _default {
    export { transform };
}
export default _default;
