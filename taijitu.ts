import { circle, fill, getCtx, strokeStyle, strokeWeight } from './module.js';

const ctx = getCtx();

const rightCircle = (cx: number, cy: number, r: number) =>
  `<path d="M ${cx},${cy - r} A ${r} ${r} 0 0 1 ${cx},${cy + r} L ${cx},${cy} Z" fill="${ctx.fillStyle}" />`;

const leftCircle = (cx: number, cy: number, r: number) =>
  `<path d="M ${cx},${cy - r} A ${r} ${r} 0 0 0 ${cx},${cy + r} L ${cx},${cy} Z" fill="${ctx.fillStyle}" />`;

const taijitsu = (x: number, y: number, size: number) => {
  let ret = '';

  const dotSize = size / 8;

  strokeWeight(5);

  strokeStyle('black');
  fill('black');
  ret += circle(x + size / 2, y + size / 2, size / 2);

  strokeWeight(0);

  fill('white');
  ret += leftCircle(x + size / 2, y + size / 2, size / 2);

  fill('black');
  ret += rightCircle(x + size / 2, y + size / 2, size / 2);

  fill('white');
  ret += circle(x + size / 2, y + size / 2 - size / 4, size / 4);

  fill('black');
  ret += circle(x + size / 2, y + size / 2 + size / 4, size / 4);

  fill('white');
  ret += circle(x + size / 2, y + size / 2 + size / 4, dotSize / 2);
  
  fill('black');
  ret += circle(x + size / 2, y + size / 2 - size / 4, dotSize / 2);
  
  return ret;
}

export default taijitsu;