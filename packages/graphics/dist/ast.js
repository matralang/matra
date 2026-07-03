import { SVG_TAGS } from './types.js';
/** Pure AST builder used by Matra and JavaScript callers alike. */
export function svgNode(tag, props = {}, children = []) {
    return { tag, props: { ...props }, children: [...children] };
}
export function isSvgNode(node) {
    return SVG_TAG_SET.has(node.tag);
}
const SVG_TAG_SET = new Set(SVG_TAGS);
//# sourceMappingURL=ast.js.map