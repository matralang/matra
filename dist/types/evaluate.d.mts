/**
 * 評価関数
 * @param {any} node - Matrast node or literal
 * @param {object} ctx - 評価コンテキスト
 * @returns {any}
 */
export function evaluate(node: any, ctx?: object): any;
/**
 * ソース文字列を評価
 * @param {string} source
 * @param {object} ctx
 * @returns {any[]}
 */
export function evaluateSource(source: string, ctx?: object): any[];
