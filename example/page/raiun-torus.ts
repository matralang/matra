import { setCanvasSize, strokeWeight, strokeStyle, fill, circle, svgLayout, g, line, text, textAnchor, textBaseline, textSize } from '../../module.js';
import { calculate, fibonacciDigit, polarOffset } from '../math.js';

const cvsSize = 256;
const [cvsW, cvsH] = [cvsSize, cvsSize];
const outerR = 96
const outerRIn = 6
const elmSize = 6

setCanvasSize(cvsW, cvsH);

strokeWeight(3);

const flkmArr = [
  { name: 'F', col: 'green' },
  { name: 'L', col: 'red' },
  { name: 'K', col: 'yellow' },
  { name: 'M', col: 'blue' }
];

const circleElmArr: any[] = []

const torusCircleElmArr: any[] = [];

Array.from({ length: 3 }).map((_, j) => {
  const [dx, dy] = polarOffset(outerRIn, j, 3, -0.5);

  fill('none');
  strokeStyle(flkmArr[calculate('Subtract(Power(2, j), 1)', { j })].col);

  const circleElm = circle(cvsW / 2 + dx, cvsH / 2 - dy, outerR);

  torusCircleElmArr.push(circleElm);
});

Array.from({ length: 1 }).map(_ => {
  fill('none');
  strokeStyle(flkmArr[2].col);

  const circleElm = circle(cvsW / 2, cvsH / 2, outerR);

  torusCircleElmArr.push(circleElm);
});

circleElmArr.push([...Array.from({ length: 3 }).map((_, j) => {
  return Array.from({ length: 25 }).map((_, i) => {
    const outer = polarOffset(outerR, i, 24, -0.5);
    const inner = polarOffset(outerRIn, j, 3, -0.5);
    const dx = calculate('Add(outer, inner)', { outer: outer[0], inner: inner[0] });
    const dy = calculate('Add(outer, inner)', { outer: outer[1], inner: inner[1] });

    strokeStyle(flkmArr[calculate('Subtract(Power(2, j), 1)', { j })].col);

    fill('white');
    strokeStyle('none');

    const circleElm = circle(cvsW / 2 + dx, cvsH / 2 - dy, elmSize / 2);

    fill('black');
    textAnchor('center');
    textBaseline('middle');
    textSize(elmSize * 0.5);
    const factor = calculate('Power(4, j)', { j });
    const textElm = text(String(fibonacciDigit(i, factor)), cvsW / 2 + dx, cvsH / 2 - dy);

    const gElm = g([
      circleElm,
      textElm,
    ]);

    circleElmArr.push(gElm);
  });
}).flat()]);

Array.from({ length: 9 }).map((_, i) => {
  const [dx, dy] = polarOffset(outerR, i, 8, -0.5);

  strokeStyle(flkmArr[2].col);

  fill('white');
  strokeStyle('none');

  const circleElm = circle(cvsW / 2 + dx, cvsH / 2 - dy, elmSize / 2);

  fill('black');
  textAnchor('center');
  textBaseline('middle');
  textSize(elmSize * 0.5);
  const textElm = text(String(fibonacciDigit(i, 3)), cvsW / 2 + dx, cvsH / 2 - dy);

  const gElm = g([
    circleElm,
    textElm,
  ]);

  circleElmArr.push(gElm);
});

const matraElmArr = [
  ...torusCircleElmArr,
  ...circleElmArr,
];

export default svgLayout(matraElmArr, cvsW, cvsH);
