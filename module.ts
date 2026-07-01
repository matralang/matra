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

const getCtx = () => {
  return ctx;
}

const setCanvasSize = (w: number, h: number) => {
  ctx.cvsW = w;
  ctx.cvsH = h;
}

const background = (col: string) => {
  ctx.fillStyle = col;
  return `<rect width="${ctx.cvsW}" height="${ctx.cvsH}" fill="${col}" />`;
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

const circle = (x: number, y: number, r: number) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${ctx.fillStyle}" stroke="${ctx.strokeStyle || 'none'}" stroke-width="${ctx.lineWidth}" />`;

const svgLayout = (content: string, width: number = 256, height: number = 256) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  ${background('white')}
  ${content}
</svg>
`;

export {
  getCtx,
  setCanvasSize,
  background,
  fill,
  strokeWeight,
  strokeStyle,
  circle,
  svgLayout,
};