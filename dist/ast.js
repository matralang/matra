/** Pure AST builder used by Matra and JavaScript callers alike. */
export function svgNode(tag, props = {}, children = []) {
    return { tag, props: { ...props }, children: [...children] };
}
export function isSvgNode(node) {
    return SVG_TAG_SET.has(node.tag);
}
const SVG_TAG_SET = new Set([
    'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
    'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'path', 'text',
    'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern',
]);
//# sourceMappingURL=ast.js.map