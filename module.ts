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

type CanvasTextAlign = 'start' | 'end' | 'left' | 'right' | 'center';

type Context = {
  cvsW: number;
  cvsH: number;
  fillStyle: string;
  strokeStyle: string;
  strokeWidth: number;
  textSize: number;
  textAnchor: CanvasTextAlign;
  textBaseline: CanvasTextAlign;
};

const ctx: Context = {
  cvsW: 256,
  cvsH: 256,
  fillStyle: '',
  strokeStyle: '',
  strokeWidth: 1,
  textSize: 12,
  textAnchor: 'start' as CanvasTextAlign,
  textBaseline: 'middle' as CanvasTextAlign,
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
  const propStr = prop
    ? ' ' + Object.entries(prop)
        .map(([key, val]) => `${key}="${val}"`)
        .join(' ')
    : '';

  const tagStr = tag;

  let bodyStr = '';
  if (body === null) {
    bodyStr = '';
  } else if (typeof body === 'string') {
    bodyStr = body;
  } else if (Array.isArray(body)) {
    bodyStr = body.map(elem => fromAst(elem)).join('\n');
  }

  if (tagStr == null) {
    return bodyStr;
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
  ctx.strokeWidth = weight;
}

const strokeStyle = (col: string) => {
  ctx.strokeStyle = col;
}

const textSize = (size: number) => {
  ctx.textSize = size;
}

const textAnchor = (align: CanvasTextAlign) => {
  ctx.textAnchor = align;
}

const textBaseline = (align: CanvasTextAlign) => {
  ctx.textBaseline = align;
}

const svg = (content: MatraElm[], width: number = 256, height: number = 256) => {
  const svgMatrast: Matrast = [[
    'svg',
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${width} ${height}`,
      width: width,
      height: height
    },
    content
  ]];

  return svgMatrast;
}

const g = (content: MatraElm[], prop: PropObj | null = null) => {
  const gMatraElm: MatraElm = [
    'g',
    prop,
    content
  ];

  return gMatraElm;
}

const shape = (shapeType: SvgTag, prop: PropObj) => {
  const ctx = getCtx();

  const shapeMatraElm: MatraElm = [
    shapeType,
    {
      ...prop,
      fill: ctx.fillStyle,
      stroke: ctx.strokeStyle || 'none',
      'stroke-width': ctx.strokeWidth
    },
    []
  ];

  return shapeMatraElm;
}

const circle = (cx: number, cy: number, r: number) => {
  const circleMatraElm = shape('circle', {
    cx: cx,
    cy: cy,
    r: r
  });

  return circleMatraElm;
}

const rect = (x: number, y: number, width: number, height: number) => {
  const rectMatraElm = shape('rect', {
    x: x,
    y: y,
    width: width,
    height: height
  });

  return rectMatraElm;
}

const path = (d: string) => {
  const pathMatraElm = shape('path', {
    d: d,
  });

  return pathMatraElm;
}

const line = (x1: number, y1: number, x2: number, y2: number) => {
  const lineMatraElm = shape('line', {
    x1: x1,
    y1: y1,
    x2: x2,
    y2: y2
  });

  return lineMatraElm;
}

// const ellipse = (cx: number, cy: number, rx: number, ry: number) => {
//   const ellipseMatraElm = shape('ellipse', {
//     cx: cx,
//     cy: cy,
//     rx: rx,
//     ry: ry
//   });

//   return ellipseMatraElm;
// }

// const polygon = (points: string) => {
//   const polygonMatraElm = shape('polygon', {
//     points: points
//   });

//   return polygonMatraElm;
// }

// const polyline = (points: string) => {
//   const polylineMatraElm = shape('polyline', {
//     points: points
//   });

//   return polylineMatraElm;
// }

const text = (content: string, x: number, y: number) => {
  const ctx = getCtx();

  const textMatraElm: MatraElm = [
    'text',
    {
      x: x,
      y: y,
      fill: ctx.fillStyle,
      'font-size': ctx.textSize,
      'text-anchor': ctx.textAnchor,
      'dominant-baseline': ctx.textBaseline
    },
    content
  ];

  return textMatraElm;
}

const svgLayout = (content: MatraElm[], width: number = 256, height: number = 256) => {
  const svgMatrast: Matrast = svg([
    background('white'),
    ...content
  ], width, height);

  return fromAst(svgMatrast[0]);
}

export {
  Matrast,
  MatraElm,
  setCanvasSize,
  fill,
  strokeWeight,
  strokeStyle,
  textSize,
  textAnchor,
  textBaseline,
  g,
  circle,
  rect,
  path,
  line,
  // ellipse,
  // polygon,
  // polyline,
  text,
  svgLayout,
};