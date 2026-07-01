// evaluate.ts — Matra v0.5 Evaluator
// ------------------------------------
// Pure evaluation layer for Matrast (AST)
import { parse } from "./parser.mjs";
/**
 * 評価関数
 * @param {any} node - Matrast node or literal
 * @param {object} ctx - 評価コンテキスト
 * @returns {any}
 */
export function evaluate(node, ctx = {}) {
    if (node == null)
        return null;
    // 文字列・数値などはそのまま返す
    if (typeof node !== "object")
        return node;
    // JSON匿名ノード ([[{...}]])
    if (Array.isArray(node) &&
        node.length === 1 &&
        typeof node[0] === "object" &&
        !Array.isArray(node[0])) {
        return node[0];
    }
    // Matraノード形式: [tag, props, body]
    const [tag, props = {}, body = []] = node;
    // --- 評価分岐 ---
    switch (tag) {
        case "p":
        case "div":
        case "span":
        case "section":
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
            // 構造を保持して返す
            return {
                type: tag,
                props: props || {},
                body: body.map(n => evaluate(n, ctx)),
            };
        case "code":
            return {
                type: "code",
                language: props.fileType || "text",
                source: body.join("\n"),
            };
        case "a":
            return {
                type: "link",
                href: props.href,
                text: body.map(n => evaluate(n, ctx)).join(""),
            };
        case "img":
            return { type: "image", alt: props.alt, src: props.src };
        case "tagdef":
            // 型定義を登録して返す
            if (!ctx.types)
                ctx.types = {};
            ctx.types[props.name] = body;
            return { type: "tagdef", name: props.name, fields: body };
        case null:
            // 空・未定義ノード
            return null;
        default:
            // 不明タグは汎用オブジェクト扱い
            return {
                type: tag,
                props,
                body: body ? body.map(n => evaluate(n, ctx)) : [],
            };
    }
}
/**
 * ソース文字列を評価
 * @param {string} source
 * @param {object} ctx
 * @returns {any[]}
 */
export function evaluateSource(source, ctx = {}) {
    const ast = parse(source);
    return ast.map(node => evaluate(node, ctx));
}
// CLI mode
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const fs = await import("fs");
    const src = process.argv[2];
    if (!src) {
        console.error("Usage: node dist/evaluate.js <file.matra>");
        process.exit(1);
    }
    const text = fs.readFileSync(src, "utf-8");
    const result = evaluateSource(text);
    console.log(JSON.stringify(result, null, 2));
}
//# sourceMappingURL=evaluate.js.map