import { isSvgNode, svgNode } from './ast.js';
export function toSVG(ast, options = {}) {
    const root = ast.tag === 'svg' ? ast : wrapInSvg(ast, options);
    if (!isSvgNode(root))
        throw new TypeError(`Unsupported SVG element: ${root.tag}`);
    const normalized = root.tag === 'svg' ? normalizeRoot(root, options) : root;
    return serializeNode(normalized);
}
export const svgRenderer = {
    render: toSVG,
};
function wrapInSvg(ast, options) {
    return svgNode('svg', {}, ast.tag === '$root' ? ast.children : [ast]);
}
function normalizeRoot(root, options) {
    const width = options.width ?? scalarNumber(root.props.width) ?? 256;
    const height = options.height ?? scalarNumber(root.props.height) ?? 256;
    const attributes = {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: `0 0 ${width} ${height}`,
        width,
        height,
        ...root.props,
        ...options.attributes,
    };
    const children = [];
    const labelledBy = [];
    if (options.title) {
        labelledBy.push('matra-title');
        children.push(svgNode('title', { id: 'matra-title' }, [options.title]));
    }
    if (options.description) {
        labelledBy.push('matra-description');
        children.push(svgNode('desc', { id: 'matra-description' }, [options.description]));
    }
    if (options.background !== null && options.background !== undefined) {
        children.push(svgNode('rect', { width: '100%', height: '100%', fill: options.background }));
    }
    children.push(...root.children);
    if (labelledBy.length) {
        Object.assign(attributes, { role: 'img', 'aria-labelledby': labelledBy.join(' ') });
    }
    return { tag: 'svg', props: attributes, children };
}
function serializeNode(node) {
    if (!isSvgNode(node))
        throw new TypeError(`Unsupported SVG element: ${node.tag}`);
    const attributes = Object.entries(node.props)
        .map(([key, value]) => serializeAttribute(key, value))
        .join('');
    const children = node.children.map(serializeChild).join('');
    return `<${node.tag}${attributes}>${children}</${node.tag}>`;
}
function serializeChild(child) {
    if (isAst(child))
        return serializeNode(child);
    if (child === null)
        return '';
    if (typeof child === 'object')
        throw new TypeError('SVG children must be elements or scalar values');
    return escapeXML(child);
}
function serializeAttribute(key, value) {
    if (value === null || value === false)
        return '';
    if (typeof value === 'object')
        throw new TypeError(`SVG attribute ${key} must be a scalar value`);
    const normalized = value === true ? key : value;
    return ` ${key}="${escapeXML(normalized)}"`;
}
function escapeXML(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}
function scalarNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function isAst(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && 'tag' in value;
}
//# sourceMappingURL=render.js.map