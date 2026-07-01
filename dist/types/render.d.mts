/**
 * @param {any} node
 * @param {{ minify?: boolean }} [_opts] Reserved for output formatting options
 * @returns {string}
 */
export function toHTML(node: any, _opts?: {
    minify?: boolean;
}): string;
/**
 * JSON出力
 * @param {any} node
 * @param {Object} [opts]
 * @param {boolean} [opts.pretty] - Pretty print JSON
 * @returns {string}
 */
export function toJSON(node: any, opts?: {
    pretty?: boolean | undefined;
}): string;
/**
 * TeX出力（強化版）
 * - Markdown/Matra対応
 * - コード、画像、リンクの最小表現をサポート
 */
export function toTeX(node: any): any;
/**
 * ESTree出力
 * Matraノードを最小限のJavaScript式に変換
 */
export function toESTree(node: any): any;
/**
 * Canvas出力
 * Matra構造をHTML Canvas命令列に変換
 */
export function toCanvas(node: any, ctx?: any[]): any[];
/**
 * ASTをHTML出力までまとめて実行
 */
export function renderHTML(source: any): string;
