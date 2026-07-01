/**
 * Matra Core - Transform Module
 * Template evaluation: m-if, m-else, m-each, {{mustache}}
 */
/**
 * Transform Matra AST with template context
 * @param {import('./types.js').MatraNode} ast
 * @param {Record<string, any>} context
 * @returns {import('./types.js').MatraNode}
 */
export declare function transform(ast: any, context?: {}): any;
declare const _default: {
    transform: typeof transform;
};
export default _default;
