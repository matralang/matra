import { fill, strokeStyle, strokeWeight, circle, path } from './module.js';
import type { MatraElm } from './module.js';

const rightCircle = (cx: number, cy: number, r: number) => {
  fill('black');

  const matraElm: MatraElm = path(`M ${cx},${cy - r} A ${r} ${r} 0 0 1 ${cx},${cy + r} L ${cx},${cy} Z`);

  return matraElm;
}

const leftCircle = (cx: number, cy: number, r: number) => {
  const matraElm: MatraElm = path(`M ${cx},${cy - r} A ${r} ${r} 0 0 0 ${cx},${cy + r} L ${cx},${cy} Z`);

  return matraElm;
}

const taijitsu = (x: number, y: number, size: number): MatraElm[] => {
  const matraElmArr: MatraElm[] = [];

  const dotSize = size / 8;

  strokeWeight(5);

  strokeStyle('black');
  fill('black');
  matraElmArr.push(circle(x + size / 2, y + size / 2, size / 2));

  strokeWeight(0);

  fill('white');
  matraElmArr.push(leftCircle(x + size / 2, y + size / 2, size / 2));

  fill('black');
  matraElmArr.push(rightCircle(x + size / 2, y + size / 2, size / 2));

  fill('white');
  matraElmArr.push(circle(x + size / 2, y + size / 2 - size / 4, size / 4));

  fill('black');
  matraElmArr.push(circle(x + size / 2, y + size / 2 + size / 4, size / 4));

  fill('white');
  matraElmArr.push(circle(x + size / 2, y + size / 2 + size / 4, dotSize / 2));

  fill('black');
  matraElmArr.push(circle(x + size / 2, y + size / 2 - size / 4, dotSize / 2));

  return matraElmArr;
}

export default taijitsu;