import { setCanvasSize, strokeWeight, strokeStyle, fill, circle, svgLayout, g, line, text, textAnchor, textBaseline, textSize } from '../../module.js';

const cvsSize = 256;
const [cvsW, cvsH] = [cvsSize, cvsSize];
const outerR = 96
const outerRIn = 12
const innerR = 36
const innerRIn = 6
const elmSize = 8

const { cos, sin, PI } = Math;

setCanvasSize(cvsW, cvsH);

strokeWeight(1);

function fib(n: number): number {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

let lineElmArr: any[] = [];

const flkmArr = [
  { name: 'F', col: 'green', normalCol: 'green', lightCol: 'lightgreen' },
  { name: 'L', col: 'red', normalCol: 'red', lightCol: 'pink' },
  { name: 'K', col: 'yellow', normalCol: 'gold', lightCol: 'yellow' },
  { name: 'M', col: 'blue', normalCol: 'blue', lightCol: 'lightblue' }
];

let circleElmArr: any[] = []

let dxPrev = 0;
let dyPrev = 0;

circleElmArr.push([...Array.from({ length: 3 }).map((_, j) => {
  return Array.from({ length: 25 }).map((_, i) => {
    const dx = - outerR * cos(2 * PI * i / 12 - PI / 2) - outerRIn * cos(2 * PI * (j / 3 + i / 24) - PI / 2);
    const dy = - outerR * sin(2 * PI * i / 12 - PI / 2) - outerRIn * sin(2 * PI * (j / 3 + i / 24) - PI / 2);

    if (i > 0) {
      strokeStyle(flkmArr[2 ** j - 1].lightCol);
      if (j === 0) {
        strokeWeight(0.88);
      } else {
        strokeWeight(0.44);
      }
      const lineElm = line(cvsW / 2 + dxPrev, cvsH / 2 - dyPrev, cvsW / 2 + dx, cvsH / 2 - dy);

      lineElmArr.push(lineElm);

      dxPrev = dx;
      dyPrev = dy;
    }

    dxPrev = dx;
    dyPrev = dy;

    if (i > 24) {
      return null;
    }

    fill(flkmArr[2 ** j - 1].lightCol);
    strokeStyle(flkmArr[2 ** j - 1].normalCol);
    strokeWeight(1);

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
  const dx = - innerR * cos(2 * PI * i / 4 - PI / 2) - innerRIn * cos(2 * PI * i / 8 - PI / 2);
  const dy = - innerR * sin(2 * PI * i / 4 - PI / 2) - innerRIn * sin(2 * PI * i / 8 - PI / 2);

  if (i > 0) {
    strokeStyle(flkmArr[2].lightCol);
    strokeWeight(0.88);
    const lineElm = line(cvsW / 2 + dxPrev, cvsH / 2 - dyPrev, cvsW / 2 + dx, cvsH / 2 - dy);

    lineElmArr.push(lineElm);

    dxPrev = dx;
    dyPrev = dy;
  }

  dxPrev = dx;
  dyPrev = dy;

  if (i > 24) {
    return null;
  }

  fill(flkmArr[2].lightCol);
  strokeStyle(flkmArr[2].normalCol);
  strokeWeight(1);

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

fill('lightgray');
strokeStyle('gray');
const cCircleElm = circle(cvsW / 2, cvsH / 2, elmSize / 2);

fill('black');
textAnchor('center');
textBaseline('middle');
textSize(elmSize * 0.5);
const cTextElm = text('0', cvsW / 2, cvsH / 2);

circleElmArr.push(g([
  cCircleElm,
  cTextElm,
]));

const matraElmArr = [
  ...lineElmArr,
  ...circleElmArr,
];

export default svgLayout(matraElmArr, cvsW, cvsH);
