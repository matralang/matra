import test from 'node:test';
import assert from 'node:assert/strict';
import {
  circle, ellipse, fill, fromAst, getCtx, noStroke, pop, push, rect,
  reset, setCanvasSize, strokeStyle, strokeWeight, svgLayout, text,
} from '../module.ts';

test('serializes escaped text and attributes safely', () => {
  assert.equal(
    fromAst(['text', { title: 'A & "B"', hidden: false }, '<hello>']),
    '<text title="A &amp; &quot;B&quot;">&lt;hello&gt;</text>',
  );
});

test('captures style when each shape is created', () => {
  reset();
  fill('#ff006e');
  strokeStyle('#111');
  strokeWeight(3);
  assert.deepEqual(circle(10, 20, 5)[1], {
    cx: 10, cy: 20, r: 5, fill: '#ff006e', stroke: '#111', 'stroke-width': 3,
  });
});

test('push and pop restore graphics state', () => {
  reset();
  fill('red');
  push();
  fill('blue');
  noStroke();
  pop();
  assert.equal(getCtx().fillStyle, 'red');
});

test('supports rounded rectangles and ellipses', () => {
  reset();
  assert.deepEqual(rect(1, 2, 30, 40, 6)[1]?.rx, 6);
  assert.equal(ellipse(10, 10, 8, 4)[0], 'ellipse');
});

test('renders an accessible SVG with an optional transparent background', () => {
  reset();
  setCanvasSize(320, 180);
  fill('black');
  const output = svgLayout([text('Matra', 20, 20)], 320, 180, {
    background: null,
    title: 'Wordmark',
    description: 'The Matra wordmark',
  });
  assert.match(output, /^<svg[^>]+viewBox="0 0 320 180"/);
  assert.match(output, /role="img" aria-labelledby="matra-title matra-description"/);
  assert.doesNotMatch(output, /<rect/);
});

test('rejects invalid dimensions without corrupting context', () => {
  reset();
  assert.throws(() => setCanvasSize(-1, 100), RangeError);
  assert.equal(getCtx().cvsW, 256);
});
