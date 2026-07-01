import { setCanvasSize, strokeWeight, strokeStyle, fill, circle, svgLayout, g, text, textAnchor, textBaseline, textSize } from '../../module.js';
import taijitsu from '../mixin/taijitu.js';

const cvsSize = 512;
const [cvsW, cvsH] = [cvsSize, cvsSize];
const outerR = 128
const elmSize = 85

const { cos, sin, PI } = Math;

setCanvasSize(cvsW, cvsH);

strokeWeight(3);

const kamomiArr = [
  { name: '木', col: 'green' },
  { name: '火', col: 'red' },
  { name: '水', col: 'blue' },
];

const circleElmArr = kamomiArr.map(({ col, name }, i) => {
  fill(col);
  const dx = - outerR * cos(2 * PI * i / 3 - PI / 2);
  const dy = - outerR * sin(2 * PI * i / 3 - PI / 2);

  strokeWeight(3);
  strokeStyle('black');

  const circleElm = circle(cvsW / 2 + dx, cvsH / 2 - dy, elmSize / 2);

  fill('white');
  textAnchor('center');
  textBaseline('middle');
  textSize(elmSize * 0.5);
  const textElm = text(name, cvsW / 2 + dx, cvsH / 2 - dy);

  const gElm = g([
    circleElm,
    textElm,
  ]);

  return gElm;
});

const matraElmArr = [
  ...circleElmArr,
  ...taijitsu(cvsW / 2 - elmSize / 2, cvsH / 2 - elmSize / 2, elmSize)
];

export default svgLayout(matraElmArr, cvsW, cvsH);
