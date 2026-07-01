type SvgTag =
  | 'svg'
  | 'g'
  | 'circle'
  | 'rect'
  | 'path'
  | 'line'
  | 'ellipse'
  | 'polygon'
  | 'polyline'
  | 'text';

type TagStr = SvgTag;
type PropObj = Record<string, string | number>;
type BodyArr = MatraElm[];

type Tag = TagStr | null;
type Prop = PropObj | null;
type Body = string | BodyArr | null;

type MatraElm = [
  Tag, Prop, Body
]

type Matrast = MatraElm[];

type Context = {
  cvsW: number;
  cvsH: number;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
};

const ctx: Context = {
  cvsW: 256,
  cvsH: 256,
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
};

const getCtx = (): Context => {
  return ctx;
}

const setCanvasSize = (w: number, h: number) => {
  ctx.cvsW = w;
  ctx.cvsH = h;
}

const fromAst = (matraElm: MatraElm): string => {
  const [tag, prop, body] = matraElm;
  const propStr = prop && Object.keys(prop).length > 0 ? ' ' + Object.entries(prop).map(([key, val]) => `${key}="${val}"`).join(' ') : '';

  const tagStr = tag;

  let bodyStr = '';
  if (body === null) {
    bodyStr = '';
  } else if (typeof body === 'string') {
    bodyStr = body;
  } else if (Array.isArray(body)) {
    bodyStr = body.map(elem => fromAst(elem)).join('\n');
  }

  return `<${tagStr}${propStr}>${bodyStr}</${tagStr}>`;
}

const background = (col: string) => {
  ctx.fillStyle = col;

  const matraElm: MatraElm = [
    'rect',
    { width: ctx.cvsW, height: ctx.cvsH, fill: ctx.fillStyle },
    []
  ];

  return matraElm;
}

const fill = (col: string) => {
  ctx.fillStyle = col;
}

const strokeWeight = (weight: number) => {
  ctx.lineWidth = weight;
}

const strokeStyle = (col: string) => {
  ctx.strokeStyle = col;
}

const circle = (x: number, y: number, r: number) => {
  const ctx = getCtx();

  const circleMatraElm: MatraElm = [
    'circle', {
      cx: x,
      cy: y,
      r: r,
      fill: ctx.fillStyle,
      stroke: ctx.strokeStyle || 'none',
      'stroke-width': ctx.lineWidth
    },
    []
  ];

  return circleMatraElm;
}

const rect = (x: number, y: number, w: number, h: number) => {
  const ctx = getCtx();

  const rectMatraElm: MatraElm = [
    'rect', {
      x: x,
      y: y,
      width: w,
      height: h,
      fill: ctx.fillStyle,
      stroke: ctx.strokeStyle || 'none',
      'stroke-width': ctx.lineWidth
    },
    []
  ];

  return rectMatraElm;
}

const path = (d: string) => {
  const ctx = getCtx();

  const pathMatraElm: MatraElm = [
    'path',
    {
      d: d,
      fill: ctx.fillStyle,
      stroke: ctx.strokeStyle || 'none',
      'stroke-width': ctx.lineWidth
    },
    []
  ];

  return pathMatraElm;
}

const svgLayout = (content: MatraElm[], width: number = 256, height: number = 256) => {
  const svgMatrast: Matrast = [[
    'svg',
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${width} ${height}`,
      width: width,
      height: height
    },
    [
      background('white'),
      ...content
    ]
  ]];

  return fromAst(svgMatrast[0]);
}

export {
  Matrast,
  MatraElm,
  setCanvasSize,
  fill,
  strokeWeight,
  strokeStyle,
  circle,
  rect,
  path,
  svgLayout,
};