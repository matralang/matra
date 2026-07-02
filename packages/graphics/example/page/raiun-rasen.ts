import { setCanvasSize, strokeWeight, strokeStyle, fill, circle, svgLayout, g, line, text, textAnchor, textBaseline, textSize } from '../../module.js';
import { calculate, fibonacciDigit, polarOffset, polarOffsetFormula } from '../math.js';

const cvsSize = 256;
const [cvsW, cvsH] = [cvsSize, cvsSize];
const outerR = 96
const outerRIn = 12
const innerR = 36
const innerRIn = 6
const elmSize = 8

setCanvasSize(cvsW, cvsH);

strokeWeight(1);

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
    const outer = polarOffset(outerR, i, 12, -0.5);
    const inner = polarOffsetFormula('Add(Divide(j, 3), Divide(i, 24))', { i, j }, outerRIn, 1, -0.5);
    const dx = calculate('Add(outer, inner)', { outer: outer[0], inner: inner[0] });
    const dy = calculate('Add(outer, inner)', { outer: outer[1], inner: inner[1] });

    if (i > 0) {
      strokeStyle(flkmArr[calculate('Subtract(Power(2, j), 1)', { j })].lightCol);
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

    const colourIndex = calculate('Subtract(Power(2, j), 1)', { j });
    fill(flkmArr[colourIndex].lightCol);
    strokeStyle(flkmArr[colourIndex].normalCol);
    strokeWeight(1);

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
  const outer = polarOffset(innerR, i, 4, -0.5);
  const inner = polarOffset(innerRIn, i, 8, -0.5);
  const dx = calculate('Add(outer, inner)', { outer: outer[0], inner: inner[0] });
  const dy = calculate('Add(outer, inner)', { outer: outer[1], inner: inner[1] });

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
  const textElm = text(String(fibonacciDigit(i, 3)), cvsW / 2 + dx, cvsH / 2 - dy);

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
