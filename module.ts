export type SvgTag =
  | 'svg' | 'g' | 'circle' | 'rect' | 'path' | 'line'
  | 'ellipse' | 'polygon' | 'polyline' | 'text' | 'title' | 'desc';

export type PropValue = string | number | boolean | null | undefined;
export type PropObj = Record<string, PropValue>;
export type MatraElm = [SvgTag | null, PropObj | null, string | MatraElm[] | null];
export type Matrast = MatraElm[];

export type CanvasTextAlign = 'start' | 'end' | 'left' | 'right' | 'center';
export type CanvasTextBaseline = 'auto' | 'middle' | 'central' | 'hanging' | 'text-top' | 'text-bottom' | 'alphabetic' | 'ideographic';

export type Context = {
  cvsW: number;
  cvsH: number;
  fillStyle: string;
  strokeStyle: string;
  strokeWidth: number;
  textSize: number;
  textAnchor: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

const initialContext: Context = {
  cvsW: 256,
  cvsH: 256,
  fillStyle: 'none',
  strokeStyle: 'none',
  strokeWidth: 1,
  textSize: 12,
  textAnchor: 'start',
  textBaseline: 'middle',
};

let ctx: Context = { ...initialContext };
const contextStack: Context[] = [];

export const getCtx = (): Readonly<Context> => ({ ...ctx });

const finite = (value: number, name: string): number => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  return value;
};

export const setCanvasSize = (width: number, height: number): void => {
  finite(width, 'width');
  finite(height, 'height');
  if (width <= 0 || height <= 0) throw new RangeError('Canvas dimensions must be greater than zero');
  ctx.cvsW = width;
  ctx.cvsH = height;
};

export const reset = (): void => {
  ctx = { ...initialContext };
  contextStack.length = 0;
};

export const push = (): void => { contextStack.push({ ...ctx }); };
export const pop = (): void => {
  const previous = contextStack.pop();
  if (!previous) throw new Error('Cannot pop an empty graphics state stack');
  ctx = previous;
};

const escapeXml = (value: PropValue): string => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

export const fromAst = ([tag, prop, body]: MatraElm): string => {
  const bodyStr = typeof body === 'string'
    ? escapeXml(body)
    : Array.isArray(body)
      ? body.map(fromAst).join('\n')
      : '';

  if (tag === null) return bodyStr;

  const attributes = prop
    ? Object.entries(prop)
        .filter(([, value]) => value !== null && value !== undefined && value !== false)
        .map(([key, value]) => ` ${key}="${escapeXml(value === true ? key : value)}"`)
        .join('')
    : '';

  return `<${tag}${attributes}>${bodyStr}</${tag}>`;
};

export const fill = (colour: string): void => { ctx.fillStyle = colour; };
export const noFill = (): void => { ctx.fillStyle = 'none'; };
export const strokeWeight = (weight: number): void => {
  finite(weight, 'stroke weight');
  if (weight < 0) throw new RangeError('Stroke weight cannot be negative');
  ctx.strokeWidth = weight;
};
export const strokeStyle = (colour: string): void => { ctx.strokeStyle = colour; };
export const noStroke = (): void => { ctx.strokeStyle = 'none'; };
export const textSize = (size: number): void => {
  finite(size, 'text size');
  if (size <= 0) throw new RangeError('Text size must be greater than zero');
  ctx.textSize = size;
};
export const textAnchor = (align: CanvasTextAlign): void => { ctx.textAnchor = align; };
export const textBaseline = (align: CanvasTextBaseline): void => { ctx.textBaseline = align; };

export const element = (tag: SvgTag, prop: PropObj = {}, body: string | MatraElm[] | null = null): MatraElm => [tag, prop, body];
export const g = (content: MatraElm[], prop: PropObj | null = null): MatraElm => ['g', prop, content];

const shape = (tag: SvgTag, prop: PropObj): MatraElm => [tag, {
  ...prop,
  fill: ctx.fillStyle,
  stroke: ctx.strokeStyle,
  'stroke-width': ctx.strokeWidth,
}, []];

export const background = (colour: string): MatraElm => ['rect', {
  width: '100%', height: '100%', fill: colour,
}, []];
export const circle = (cx: number, cy: number, r: number): MatraElm => shape('circle', { cx, cy, r });
export const rect = (x: number, y: number, width: number, height: number, radius = 0): MatraElm => shape('rect', {
  x, y, width, height, ...(radius > 0 ? { rx: radius, ry: radius } : {}),
});
export const ellipse = (cx: number, cy: number, rx: number, ry: number): MatraElm => shape('ellipse', { cx, cy, rx, ry });
export const line = (x1: number, y1: number, x2: number, y2: number): MatraElm => shape('line', { x1, y1, x2, y2 });
export const path = (d: string): MatraElm => shape('path', { d });
export const polygon = (points: string): MatraElm => shape('polygon', { points });
export const polyline = (points: string): MatraElm => shape('polyline', { points });

export const text = (content: string, x: number, y: number): MatraElm => ['text', {
  x, y,
  fill: ctx.fillStyle,
  'font-size': ctx.textSize,
  'text-anchor': ctx.textAnchor,
  'dominant-baseline': ctx.textBaseline,
}, content];

export type SvgOptions = {
  width?: number;
  height?: number;
  background?: string | null;
  title?: string;
  description?: string;
  attributes?: PropObj;
};

export const svg = (content: MatraElm[], width = ctx.cvsW, height = ctx.cvsH, attributes: PropObj = {}): Matrast => [[
  'svg',
  { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${width} ${height}`, width, height, ...attributes },
  content,
]];

export const svgLayout = (content: MatraElm[], width = ctx.cvsW, height = ctx.cvsH, options: Omit<SvgOptions, 'width' | 'height'> = {}): string => {
  const { background: backgroundColour = 'white', title, description, attributes = {} } = options;
  const labelledBy: string[] = [];
  const children: MatraElm[] = [];

  if (title) { labelledBy.push('matra-title'); children.push(element('title', { id: 'matra-title' }, title)); }
  if (description) { labelledBy.push('matra-description'); children.push(element('desc', { id: 'matra-description' }, description)); }
  if (backgroundColour !== null) children.push(background(backgroundColour));
  children.push(...content);

  const accessibility = labelledBy.length
    ? { role: 'img', 'aria-labelledby': labelledBy.join(' ') }
    : {};
  return fromAst(svg(children, width, height, { ...accessibility, ...attributes })[0]);
};
