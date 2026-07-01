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
export function compile(source: string, opts?: {
    minify?: boolean | undefined;
    grammarSource?: string | undefined;
    context?: Record<string, any> | undefined;
    mode?: "mixed" | "document" | "application" | undefined;
}): string;
/**
 * Template function with context
 * Returns a function that compiles Matra source with given context
 * @param {Record<string, any>} context - Template context
 * @returns {Function} Template function
 */
export function with_(context: Record<string, any>): Function;
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
export function matra(input: string, options?: {
    output?: string | undefined;
    minify?: boolean | undefined;
    grammarSource?: string | undefined;
    context?: Record<string, any> | undefined;
    mode?: "mixed" | "document" | "application" | undefined;
}): string | Object | Array<unknown>;
export { parse } from "./parser.mjs";
export { transform } from "./transform.mjs";
export { MATRA_VERSION } from "./types.mjs";
export const VERSION: "0.8.1";
declare namespace _default {
    export { parse };
    export { compile };
    export { matra };
    export { with_ as with };
    export { transform };
    export { toHTML };
    export { toJSON };
    export { toTeX };
    export { toESTree };
    export { toCanvas };
    export { VERSION };
}
export default _default;
import { parse } from "./parser.mjs";
import { transform } from "./transform.mjs";
import { toHTML } from "./render.mjs";
import { toJSON } from "./render.mjs";
import { toTeX } from "./render.mjs";
import { toESTree } from "./render.mjs";
import { toCanvas } from "./render.mjs";
export { toHTML, toJSON, toTeX, toESTree, toCanvas } from "./render.mjs";
