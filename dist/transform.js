/**
 * Matra Core - Transform Module
 * Template evaluation: m-if, m-else, m-each, {{mustache}}
 */
/**
 * Get value from context by dot-separated path
 * @param {Record<string, any>[]} scopes
 * @param {string} path
 * @returns {any}
 */
function getByPath(scopes, path) {
    const parts = path.split('.').map(s => s.trim()).filter(Boolean);
    if (!parts.length)
        return undefined;
    // Search from most recent scope (last to first)
    for (let si = scopes.length - 1; si >= 0; si--) {
        let cur = scopes[si];
        let ok = true;
        for (const p of parts) {
            if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
                cur = cur[p];
            }
            else if (cur && typeof cur === 'object' && p in cur) {
                cur = cur[p];
            }
            else {
                ok = false;
                break;
            }
        }
        if (ok)
            return cur;
    }
    return undefined;
}
/**
 * Interpolate {{mustache}} variables in string
 * @param {Record<string, any>[]} scopes
 * @param {string} str
 * @returns {string}
 */
function interpolateString(scopes, str) {
    const MUSTACHE_RE = /\{\{\s*([^}]+?)\s*\}\}/g;
    return str.replace(MUSTACHE_RE, (_, expr) => {
        const v = getByPath(scopes, String(expr));
        if (v === null || v === undefined)
            return '';
        if (typeof v === 'string')
            return v;
        if (typeof v === 'number' || typeof v === 'boolean')
            return String(v);
        return '';
    });
}
/**
 * Clone node deeply
 * @param {any} node
 * @returns {any}
 */
function cloneNode(node) {
    return JSON.parse(JSON.stringify(node));
}
/**
 * Find next element sibling (skip whitespace-only text nodes)
 * @param {any[]} list
 * @param {number} idx
 * @returns {{ el: any, index: number } | null}
 */
function nextElementSibling(list, idx) {
    for (let j = idx + 1; j < list.length; j++) {
        const n = list[j];
        if (n?.type === 'text') {
            const v = n.value;
            if (typeof v === 'string' && v.trim() === '')
                continue;
            return null; // non-empty text, not an else
        }
        if (n?.type === 'element')
            return { el: n, index: j };
        return null;
    }
    return null;
}
/**
 * Transform node list with template directives
 * @param {any[]} nodeList
 * @param {Record<string, any>[]} scopes
 * @returns {any[]}
 */
function transformWithScopes(nodeList, scopes) {
    if (!Array.isArray(nodeList))
        return [];
    const out = [];
    for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i];
        // Text node - interpolate {{mustache}}
        if (node.type === "text") {
            const interpolated = interpolateString(scopes, node.value || "");
            out.push({ type: "text", value: interpolated });
            continue;
        }
        // Comment node - pass through without modification
        if (node.type === "comment") {
            out.push(node);
            continue;
        }
        // Element node
        if (node.type === "element") {
            const props = node.properties || {};
            // ==== ATTRIBUTE-BASED DIRECTIVES (higher priority) ====
            // m-if attribute
            if (props["m-if"] != null) {
                const testPath = String(props["m-if"]);
                const truthy = !!getByPath(scopes, testPath);
                if (truthy) {
                    // Remove m-if and process
                    const cloned = {
                        ...node,
                        properties: { ...props },
                        children: node.children ? [...node.children] : [],
                    };
                    delete cloned.properties["m-if"];
                    const processed = transformWithScopes([cloned], scopes);
                    out.push(...processed);
                    // Check if next is m-else and skip it
                    if (i + 1 < nodeList.length) {
                        const nextNode = nodeList[i + 1];
                        if (nextNode.type === "element") {
                            const nextProps = nextNode.properties || {};
                            if (nextNode.tagName === "m-else" ||
                                nextProps["m-else"] != null) {
                                i++; // consume m-else
                            }
                        }
                    }
                }
                else {
                    // Check for m-else
                    if (i + 1 < nodeList.length) {
                        const nextNode = nodeList[i + 1];
                        if (nextNode.type === "element") {
                            const nextProps = nextNode.properties || {};
                            // m-else tag: expand children
                            if (nextNode.tagName === "m-else") {
                                i++; // consume m-else
                                const processed = transformWithScopes(nextNode.children || [], scopes);
                                out.push(...processed);
                                continue;
                            }
                            // m-else attribute: expand element without attribute
                            if (nextProps["m-else"] != null) {
                                i++; // consume m-else
                                const cloned = {
                                    ...nextNode,
                                    properties: { ...nextProps },
                                    children: nextNode.children ? [...nextNode.children] : [],
                                };
                                delete cloned.properties["m-else"];
                                const processed = transformWithScopes([cloned], scopes);
                                out.push(...processed);
                                continue;
                            }
                        }
                    }
                    // No m-else found, just skip this m-if node
                }
                continue;
            }
            // m-each attribute (also m-of)
            const eachKey = props["m-each"] || props["m-of"];
            if (eachKey != null) {
                const ofPath = String(eachKey);
                const asName = String(props["m-as"] || "item");
                const indexName = String(props["m-index"] || "index");
                const items = getByPath(scopes, ofPath);
                if (Array.isArray(items)) {
                    const baseNode = {
                        ...node,
                        properties: { ...props },
                        children: node.children ? [...node.children] : [],
                    };
                    // Remove m-* attributes
                    delete baseNode.properties["m-each"];
                    delete baseNode.properties["m-of"];
                    delete baseNode.properties["m-as"];
                    delete baseNode.properties["m-index"];
                    for (let idx = 0; idx < items.length; idx++) {
                        const item = items[idx];
                        const frame = {
                            [asName]: item,
                            index: idx,
                        };
                        if (indexName && indexName !== "index") {
                            frame[indexName] = idx;
                        }
                        // Process with new scope
                        const newScopes = [frame, ...scopes];
                        const processed = transformWithScopes([baseNode], newScopes);
                        out.push(...processed);
                    }
                }
                continue;
            }
            // ==== TAG-BASED DIRECTIVES ====
            const tagName = node.tagName;
            // m-if tag
            if (tagName === "m-if") {
                const testPath = String(props.test || "");
                const truthy = !!getByPath(scopes, testPath);
                if (truthy) {
                    const processed = transformWithScopes(node.children || [], scopes);
                    out.push(...processed);
                    // Skip next m-else if exists
                    if (i + 1 < nodeList.length) {
                        const nextNode = nodeList[i + 1];
                        if (nextNode.type === "element" && nextNode.tagName === "m-else") {
                            i++;
                        }
                    }
                }
                else {
                    // Check for m-else tag
                    if (i + 1 < nodeList.length) {
                        const nextNode = nodeList[i + 1];
                        if (nextNode.type === "element" && nextNode.tagName === "m-else") {
                            i++;
                            const processed = transformWithScopes(nextNode.children || [], scopes);
                            out.push(...processed);
                        }
                    }
                }
                continue;
            }
            // m-else tag (should be consumed by m-if)
            if (tagName === "m-else") {
                continue;
            }
            // m-each tag
            if (tagName === "m-each") {
                const ofPath = String(props.of || props.each || "");
                const asName = String(props.as || "item");
                const indexName = String(props.index || "index");
                const items = getByPath(scopes, ofPath);
                if (Array.isArray(items)) {
                    for (let idx = 0; idx < items.length; idx++) {
                        const item = items[idx];
                        const frame = {
                            [asName]: item,
                            index: idx,
                        };
                        if (indexName && indexName !== "index") {
                            frame[indexName] = idx;
                        }
                        const newScopes = [frame, ...scopes];
                        const processed = transformWithScopes(node.children || [], scopes);
                        out.push(...processed);
                    }
                }
                continue;
            }
            // ==== REGULAR ELEMENT ====
            const newNode = {
                type: "element",
                tagName: node.tagName,
                properties: {},
                children: [],
            };
            // Interpolate properties
            if (props) {
                for (const [key, val] of Object.entries(props)) {
                    if (val == null)
                        continue;
                    if (typeof val === "string") {
                        newNode.properties[key] = interpolateString(scopes, val);
                    }
                    else {
                        newNode.properties[key] = val;
                    }
                }
            }
            // Process children
            newNode.children = transformWithScopes(node.children || [], scopes);
            out.push(newNode);
            continue;
        }
        // Root or unknown node
        if (node.type === "root") {
            const processed = transformWithScopes(node.children || [], scopes);
            out.push(...processed);
            continue;
        }
        // Fallback: pass through
        out.push(node);
    }
    return out;
}
/**
 * Transform Matra AST with template context
 * @param {import('./types.js').MatraNode} ast
 * @param {Record<string, any>} context
 * @returns {import('./types.js').MatraNode}
 */
export function transform(ast, context = {}) {
    if (ast == null)
        return ast;
    // Wrap single node in array for uniform processing
    const nodeList = Array.isArray(ast) ? ast : [ast];
    const scopes = [context];
    const transformed = transformWithScopes(nodeList, scopes);
    // If input was single node, return single node (or empty if filtered out)
    if (!Array.isArray(ast)) {
        return transformed.length > 0 ? transformed[0] : null;
    }
    return transformed;
}
export default { transform };
//# sourceMappingURL=transform.js.map