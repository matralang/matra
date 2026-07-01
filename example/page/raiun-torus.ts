import { setCanvasSize, strokeWeight, strokeStyle, fill, circle, svgLayout, g, line, text, textAnchor, textBaseline, textSize } from '../../module.js';

const cvsSize = 256;
const [cvsW, cvsH] = [cvsSize, cvsSize];
const outerR = 96
const outerRIn = 6
const elmSize = 6

const { cos, sin, PI } = Math;

setCanvasSize(cvsW, cvsH);

strokeWeight(3);

function fib(n: number): number {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

const flkmArr = [
  { name: 'F', col: 'green' },
  { name: 'L', col: 'red' },
  { name: 'K', col: 'yellow' },
  { name: 'M', col: 'blue' }
];

const circleElmArr: any[] = []

const torusCircleElmArr: any[] = [];

Array.from({ length: 3 }).map((_, j) => {
  const dx = - outerRIn * cos(2 * PI * j / 3 - PI / 2);
  const dy = - outerRIn * sin(2 * PI * j / 3 - PI / 2);

  fill('none');
  strokeStyle(flkmArr[2 ** j - 1].col);

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
    const dx = - outerR * cos(2 * PI * i / 24 - PI / 2) - outerRIn * cos(2 * PI * j / 3 - PI / 2);
    const dy = - outerR * sin(2 * PI * i / 24 - PI / 2) - outerRIn * sin(2 * PI * j / 3 - PI / 2);

    strokeStyle(flkmArr[2 ** j - 1].col);

    fill('white');
    strokeStyle('none');

    const circleElm = circle(cvsW / 2 + dx, cvsH / 2 - dy, elmSize / 2);

    fill('black');
    textAnchor('center');
    textBaseline('middle');
    textSize(elmSize * 0.5);
    const textElm = text(String((4 ** j * fib(i)) % 9), cvsW / 2 + dx, cvsH / 2 - dy);

    const gElm = g([
      circleElm,
      textElm,
    ]);

    circleElmArr.push(gElm);
  });
}).flat()]);

Array.from({ length: 9 }).map((_, i) => {
  const dx = - outerR * cos(2 * PI * i / 8 - PI / 2);
  const dy = - outerR * sin(2 * PI * i / 8 - PI / 2);

  strokeStyle(flkmArr[2].col);

  fill('white');
  strokeStyle('none');

  const circleElm = circle(cvsW / 2 + dx, cvsH / 2 - dy, elmSize / 2);

  fill('black');
  textAnchor('center');
  textBaseline('middle');
  textSize(elmSize * 0.5);
  const textElm = text(String((3 * fib(i)) % 9), cvsW / 2 + dx, cvsH / 2 - dy);

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
