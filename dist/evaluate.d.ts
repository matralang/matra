export interface EvaluationContext {
    types?: Record<string, unknown>;
    [key: string]: unknown;
}
/**
 * 評価関数
 * @param {any} node - Matrast node or literal
 * @param {object} ctx - 評価コンテキスト
 * @returns {any}
 */
export declare function evaluate(node: any, ctx?: EvaluationContext): any;
/**
 * ソース文字列を評価
 * @param {string} source
 * @param {object} ctx
 * @returns {any[]}
 */
export declare function evaluateSource(source: string, ctx?: EvaluationContext): any[];
