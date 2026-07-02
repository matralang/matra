import { setCanvasSize, strokeWeight, strokeStyle, fill, circle, svgLayout } from '../../module.js';
import { calculate, polarOffset } from '../math.js';

const cvsSize = 256;
const [cvsW, cvsH] = [cvsSize, cvsSize];
const outerR = 48
const outerRIn = 32

setCanvasSize(cvsW, cvsH);

strokeWeight(outerRIn);

const flkmArr = [
  { name: 'F', col: 'green' },
  { name: 'L', col: 'red' },
  { name: 'K', col: 'yellow' },
  { name: 'M', col: 'blue' }
];

const torusCircleElmArr: any[] = [];

// 重なり順を三角形対称にしたい
Array.from({ length: 3 }).map((_, j) => {
  const [dx, dy] = polarOffset(outerRIn, j, 3, -0.5);

  fill('transparent');
  strokeStyle(flkmArr[calculate('Subtract(Power(2, j), 1)', { j })].col);

  const circleElm = circle(cvsW / 2 + dx, cvsH / 2 - dy, outerR);

  torusCircleElmArr.push(circleElm);
});

Array.from({ length: 1 }).map(_ => {
  fill('transparent');
  strokeStyle(flkmArr[2].col);

  const circleElm = circle(cvsW / 2, cvsH / 2, outerR);

  torusCircleElmArr.push(circleElm);
});

const matraElmArr: any[] = [
  ...torusCircleElmArr,
];

export default svgLayout(matraElmArr, cvsW, cvsH);
