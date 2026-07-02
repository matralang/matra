import { fill, strokeStyle, strokeWeight, circle, path, push, pop } from '../../module.ts';

const rightCircle = (cx, cy, r) => {
  fill('black');

  const matraElm = path(`M ${cx},${cy - r} A ${r} ${r} 0 0 1 ${cx},${cy + r} L ${cx},${cy} Z`);

  return matraElm;
}

const leftCircle = (cx, cy, r) => {
  const matraElm = path(`M ${cx},${cy - r} A ${r} ${r} 0 0 0 ${cx},${cy + r} L ${cx},${cy} Z`);

  return matraElm;
}

const taijitu = (x, y, size) => {
  const matraElmArr = [];
  const dotSize = size / 8;

  push();

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

  pop();

  return matraElmArr;
}

export default taijitu;
