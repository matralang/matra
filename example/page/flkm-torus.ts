import { setCanvasSize, strokeWeight, strokeStyle, fill, circle, svgLayout } from '../../module.js';

const cvsSize = 256;
const [cvsW, cvsH] = [cvsSize, cvsSize];
const outerR = 89
const outerRIn = 13

const { cos, sin, PI } = Math;

setCanvasSize(cvsW, cvsH);

strokeWeight(13);

const flkmArr = [
  { name: 'F', col: 'green' },
  { name: 'L', col: 'red' },
  { name: 'K', col: 'yellow' },
  { name: 'M', col: 'blue' }
];

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

const matraElmArr: any[] = [
  ...torusCircleElmArr,
];

export default svgLayout(matraElmArr, cvsW, cvsH);
