/**
 * @butchi/matra-core
 * Matra Language Core - Parser and Runtime
 *
 * Unified language for document, data, and code representation
 */
import { parse } from "./parser.mjs";
import { toHTML, toJSON, toTeX, toESTree, toCanvas } from "./render.js";
import { transform } from "./transform.js";
export { parse } from "./parser.mjs";
export { toHTML, toJSON, toTeX, toESTree, toCanvas } from "./render.js";
export { transform } from "./transform.js";
export { MATRA_VERSION } from "./types.js";
export type * from "./types.js";
export type SyntaxMode = "mixed" | "document" | "application";
export type OutputFormat = "html" | "json" | "tex" | "estree" | "canvas";
export interface CompileOptions {
    minify?: boolean;
    grammarSource?: string;
    context?: Record<string, unknown>;
    mode?: SyntaxMode;
}
export interface MatraOptions extends CompileOptions {
    output?: OutputFormat;
}
/**
 * Compile Matra source code to HTML
 * @param {string} source - Matra source code
 * @param {Object} [opts] - Compilation options
 * @param {boolean} [opts.minify] - Minify output
 * @param {string} [opts.grammarSource] - Source name for error messages
 * @param {Record<string, any>} [opts.context] - Template context for variable interpolation
 * @param {'mixed'|'document'|'application'} [opts.mode='mixed'] - Syntax mode
 *   - 'mixed': Both Block and Function syntax (default, backward compatible)
 *   - 'document': Block syntax only (Pug-style with .class, #id, [attr])
 *   - 'application': Function syntax only (JSX-style)
 * @returns {string} HTML string
 */
export declare function compile(source: string, opts?: CompileOptions): string;
/**
 * Template function with context
 * Returns a function that compiles Matra source with given context
 * @param {Record<string, any>} context - Template context
 * @returns {Function} Template function
 */
export declare function with_(context: Record<string, unknown>): (source: string | TemplateStringsArray, ...values: unknown[]) => string;
/**
 * 高水準API — Matra構文から任意出力へ
 * Unified interface for parsing and rendering Matra source
 * @param {string} input - Matra source code
 * @param {Object} [options] - Processing options
 * @param {string} [options.output='html'] - Output format: 'html', 'json', 'tex', 'estree', 'canvas'
 * @param {boolean} [options.minify] - Minify output (for HTML)
 * @param {string} [options.grammarSource] - Source name for error messages
 * @param {Record<string, any>} [options.context] - Template context
 * @param {'mixed'|'document'|'application'} [options.mode='mixed'] - Syntax mode
 *   - 'mixed': Both Block and Function syntax (default)
 *   - 'document': Block syntax only (Pug-style)
 *   - 'application': Function syntax only (JSX-style)
 * @returns {string|Object|Array<unknown>} Rendered output in specified format
 */
export declare function matra(input: string, options?: MatraOptions): any;
export declare const VERSION = "0.8.1";
declare const _default: {
    parse: typeof parse;
    compile: typeof compile;
    matra: typeof matra;
    with: typeof with_;
    transform: typeof transform;
    toHTML: typeof toHTML;
    toJSON: typeof toJSON;
    toTeX: typeof toTeX;
    toESTree: typeof toESTree;
    toCanvas: typeof toCanvas;
    VERSION: string;
};
export default _default;
