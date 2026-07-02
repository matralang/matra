const initialContext = {
    cvsW: 256,
    cvsH: 256,
    fillStyle: 'none',
    strokeStyle: 'none',
    strokeWidth: 1,
    textSize: 12,
    textAnchor: 'start',
    textBaseline: 'middle',
};
let ctx = { ...initialContext };
const contextStack = [];
export const getCtx = () => ({ ...ctx });
const finite = (value, name) => {
    if (!Number.isFinite(value))
        throw new TypeError(`${name} must be a finite number`);
    return value;
};
export const setCanvasSize = (width, height) => {
    finite(width, 'width');
    finite(height, 'height');
    if (width <= 0 || height <= 0)
        throw new RangeError('Canvas dimensions must be greater than zero');
    ctx.cvsW = width;
    ctx.cvsH = height;
};
export const reset = () => {
    ctx = { ...initialContext };
    contextStack.length = 0;
};
export const push = () => { contextStack.push({ ...ctx }); };
export const pop = () => {
    const previous = contextStack.pop();
    if (!previous)
        throw new Error('Cannot pop an empty graphics state stack');
    ctx = previous;
};
const escapeXml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
export const fromAst = ([tag, prop, body]) => {
    const bodyStr = typeof body === 'string'
        ? escapeXml(body)
        : Array.isArray(body)
            ? body.map(fromAst).join('\n')
            : '';
    if (tag === null)
        return bodyStr;
    const attributes = prop
        ? Object.entries(prop)
            .filter(([, value]) => value !== null && value !== undefined && value !== false)
            .map(([key, value]) => ` ${key}="${escapeXml(value === true ? key : value)}"`)
            .join('')
        : '';
    return `<${tag}${attributes}>${bodyStr}</${tag}>`;
};
export const fill = (colour) => { ctx.fillStyle = colour; };
export const noFill = () => { ctx.fillStyle = 'none'; };
export const strokeWeight = (weight) => {
    finite(weight, 'stroke weight');
    if (weight < 0)
        throw new RangeError('Stroke weight cannot be negative');
    ctx.strokeWidth = weight;
};
export const strokeStyle = (colour) => { ctx.strokeStyle = colour; };
export const noStroke = () => { ctx.strokeStyle = 'none'; };
export const textSize = (size) => {
    finite(size, 'text size');
    if (size <= 0)
        throw new RangeError('Text size must be greater than zero');
    ctx.textSize = size;
};
export const textAnchor = (align) => { ctx.textAnchor = align; };
export const textBaseline = (align) => { ctx.textBaseline = align; };
export const element = (tag, prop = {}, body = null) => [tag, prop, body];
export const g = (content, prop = null) => ['g', prop, content];
const shape = (tag, prop) => [tag, {
        ...prop,
        fill: ctx.fillStyle,
        stroke: ctx.strokeStyle,
        'stroke-width': ctx.strokeWidth,
    }, []];
export const background = (colour) => ['rect', {
        width: '100%', height: '100%', fill: colour,
    }, []];
export const circle = (cx, cy, r) => shape('circle', { cx, cy, r });
export const rect = (x, y, width, height, radius = 0) => shape('rect', {
    x, y, width, height, ...(radius > 0 ? { rx: radius, ry: radius } : {}),
});
export const ellipse = (cx, cy, rx, ry) => shape('ellipse', { cx, cy, rx, ry });
export const line = (x1, y1, x2, y2) => shape('line', { x1, y1, x2, y2 });
export const path = (d) => shape('path', { d });
export const polygon = (points) => shape('polygon', { points });
export const polyline = (points) => shape('polyline', { points });
export const text = (content, x, y) => ['text', {
        x, y,
        fill: ctx.fillStyle,
        'font-size': ctx.textSize,
        'text-anchor': ctx.textAnchor,
        'dominant-baseline': ctx.textBaseline,
    }, content];
export const svg = (content, width = ctx.cvsW, height = ctx.cvsH, attributes = {}) => [[
        'svg',
        { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${width} ${height}`, width, height, ...attributes },
        content,
    ]];
export const svgLayout = (content, width = ctx.cvsW, height = ctx.cvsH, options = {}) => {
    const { background: backgroundColour = 'white', title, description, attributes = {} } = options;
    const labelledBy = [];
    const children = [];
    if (title) {
        labelledBy.push('matra-title');
        children.push(element('title', { id: 'matra-title' }, title));
    }
    if (description) {
        labelledBy.push('matra-description');
        children.push(element('desc', { id: 'matra-description' }, description));
    }
    if (backgroundColour !== null)
        children.push(background(backgroundColour));
    children.push(...content);
    const accessibility = labelledBy.length
        ? { role: 'img', 'aria-labelledby': labelledBy.join(' ') }
        : {};
    return fromAst(svg(children, width, height, { ...accessibility, ...attributes })[0]);
};
//# sourceMappingURL=legacy.js.map