import {
  circle, element, fill, g, noStroke, path, pop, push, setCanvasSize,
  strokeStyle, strokeWeight, svgLayout,
} from '../module.ts';
import taijitu from '../taijitu.js';

const size = 512;
const centre = size / 2;
setCanvasSize(size, size);

const orbit = element('circle', {
  cx: centre,
  cy: centre,
  r: 154,
  fill: 'none',
  stroke: '#d8d4ca',
  'stroke-width': 2,
  'stroke-dasharray': '3 10',
});

const rays = Array.from({ length: 12 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 12;
  const inner = 184;
  const outer = index % 3 === 0 ? 204 : 196;
  return element('line', {
    x1: centre + Math.cos(angle) * inner,
    y1: centre + Math.sin(angle) * inner,
    x2: centre + Math.cos(angle) * outer,
    y2: centre + Math.sin(angle) * outer,
    stroke: '#bbb5a8',
    'stroke-width': index % 3 === 0 ? 3 : 2,
    'stroke-linecap': 'round',
  });
});

const satellites = ['#ef476f', '#3a86ff'].map((colour, index) => {
  const y = index === 0 ? 102 : 410;
  push();
  fill(colour);
  strokeStyle('#171717');
  strokeWeight(4);
  const shadow = element('circle', { cx: centre + 4, cy: y + 6, r: 33, fill: '#171717', opacity: 0.12 });
  const body = circle(centre, y, 30);
  pop();
  return g([shadow, body]);
});

push();
noStroke();
fill('#171717');
const mark = taijitu(centre - 66, centre - 66, 132);
pop();

const halo = path('M 256 164 A 92 92 0 1 1 255.9 164');
if (halo[1]) Object.assign(halo[1], {
  fill: 'none', stroke: '#171717', 'stroke-width': 2, opacity: 0.16,
});

export default svgLayout([
  element('circle', { cx: centre, cy: centre, r: 224, fill: '#f3f0e8' }),
  orbit,
  ...rays,
  halo,
  ...satellites,
  ...mark,
], size, size, {
  background: '#fbfaf7',
  title: 'Kami',
  description: 'A taijitu symbol encircled by two colourful orbiting forms.',
});
