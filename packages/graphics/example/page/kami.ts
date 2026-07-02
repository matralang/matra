import {
  circle, fill, noStroke, pop, push, setCanvasSize,
  strokeStyle, strokeWeight, svgLayout,
} from '../../module.js';
import taijitu from '../mixin/taijitu.js';

const size = 512;
const centre = size / 2;
setCanvasSize(size, size);

const satellites = ['#ef476f', '#3a86ff'].map((colour, index) => {
  const y = index === 0 ? centre - 132 : centre + 132;
  push();
  fill(colour);
  strokeStyle('#171717');
  strokeWeight(4);
  const body = circle(centre, y, 32);
  pop();
  return body;
});

push();
noStroke();
fill('#171717');
const mark = taijitu(centre - 32, centre - 32, 64);
pop();

export default svgLayout([
  ...satellites,
  ...mark,
], size, size, {
  background: '#fbfaf7',
  title: 'Kami',
  description: 'A taijitu symbol.',
});
