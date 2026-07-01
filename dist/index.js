/**
 * @butchi/matra-core
 * Matra Language Core - Parser and Runtime
 *
 * Unified language for document, data, and code representation
 */
import { parse } from "./parser.mjs";
import { toHTML, toJSON, toTeX, toESTree, toCanvas } from "./render.js";
import { transform } from "./transform.js";
import { MATRA_VERSION } from "./types.js";
export { parse } from "./parser.mjs";
export { toHTML, toJSON, toTeX, toESTree, toCanvas } from "./render.js";
export { transform } from "./transform.js";
export { MATRA_VERSION } from "./types.js";
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
export function compile(source, opts = {}) {
    const mode = opts.mode ?? 'mixed';
    let ast = parse(source, {
        grammarSource: opts.grammarSource,
        syntaxMode: mode
    });
    if (opts.context) {
        ast = transform(ast, opts.context);
    }
    return toHTML(ast, { minify: opts.minify });
}
/**
 * Template function with context
 * Returns a function that compiles Matra source with given context
 * @param {Record<string, any>} context - Template context
 * @returns {Function} Template function
 */
export function with_(context) {
    return (source, ...values) => {
        // Support both plain string and template literal
        let templateSource;
        if (typeof source === 'string') {
            // Plain string
            templateSource = source;
        }
        else if (Array.isArray(source) && 'raw' in source) {
            // Template literal (TemplateStringsArray)
            templateSource = source.reduce((acc, str, i) => {
                return acc + str + (values[i] !== undefined ? String(values[i]) : '');
            }, '');
        }
        else {
            throw new TypeError('with_() requires a string or template literal');
        }
        return compile(templateSource, { context });
    };
}
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
export function matra(input, options = {}) {
    const output = options.output ?? "html";
    const mode = options.mode ?? "mixed";
    let ast = parse(input, {
        grammarSource: options.grammarSource,
        syntaxMode: mode
    });
    if (options.context) {
        ast = transform(ast, options.context);
    }
    switch (output) {
        case "html":
            return toHTML(ast, { minify: options.minify });
        case "json":
            return toJSON(ast, { pretty: !options.minify });
        case "tex":
            return toTeX(ast);
        case "estree":
            return toESTree(ast);
        case "canvas":
            return toCanvas(ast);
        default:
            throw new Error(`Unknown output format: ${output}`);
    }
}
// Version info
export const VERSION = MATRA_VERSION;
// Re-export for convenience
export default {
    parse,
    compile,
    matra,
    with: with_,
    transform,
    toHTML,
    toJSON,
    toTeX,
    toESTree,
    toCanvas,
    VERSION,
};
//# sourceMappingURL=index.js.map