import { setCanvasSize, strokeStyle, strokeWeight, fill, circle, svgLayout } from './module.js';
import taijitsu from './taijitu.js';

const cvsSize = 512;
const [cvsW, cvsH] = [cvsSize, cvsSize];
const outerR = 128
const elmSize = 64

const { cos, sin, PI } = Math;

setCanvasSize(cvsW, cvsH);

strokeWeight(3);

const circleElmArr = [
  'blue',
  'red',
].map((col, i) => {
  fill(col);
  const dx = outerR * cos(2 * PI * i / 2 - PI / 2);
  const dy = outerR * sin(2 * PI * i / 2 - PI / 2);

  strokeWeight(3);
  strokeStyle('black');

  return circle(cvsW / 2 + dx, cvsH / 2 - dy, elmSize / 2);
})

const svgTxt = svgLayout(`
  ${circleElmArr.join('\n  ')}
  ${taijitsu(cvsW / 2 - elmSize / 2, cvsH / 2 - elmSize / 2, elmSize)}
`, cvsW, cvsH);

console.log(svgTxt);
