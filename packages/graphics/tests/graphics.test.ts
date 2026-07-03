import assert from 'node:assert/strict';
import test from 'node:test';
import { parse, renderWith } from '@matra/core';
import { compile, svgNode, svgRenderer, toSVG } from '../src/index.ts';

test('renders a Matra graphics AST as SVG', () => {
  const ast = svgNode('svg', { width: 100, height: 80 }, [
    svgNode('circle', { cx: 50, cy: 40, r: 20, fill: 'tomato' }),
  ]);
  assert.equal(
    toSVG(ast),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" width="100" height="80"><circle cx="50" cy="40" r="20" fill="tomato"></circle></svg>',
  );
});

test('compiles Matra source to SVG', () => {
  const result = compile('svg(circle(cx=32, cy=32, r=20, fill="red"), width=64, height=64)');
  assert.match(result, /^<svg[^>]+viewBox="0 0 64 64"/);
  assert.match(result, /<circle cx="32" cy="32" r="20" fill="red"><\/circle>/);
});

test('implements the core renderer contract', () => {
  const ast = parse('rect(x=1, y=2, width=3, height=4)');
  const result = renderWith(svgRenderer, ast, { width: 10, height: 10 });
  assert.match(result, /<rect x="1" y="2" width="3" height="4"><\/rect>/);
});

test('rejects non-SVG Matra elements', () => {
  assert.throws(() => compile('script("alert(1)")'), /Unsupported SVG element/);
});

test('wraps a Matra document fragment in an SVG root', () => {
  const result = toSVG({ tag: '$root', props: {}, children: [
    svgNode('circle', { cx: 10, cy: 10, r: 5 }),
    svgNode('rect', { x: 20, y: 20, width: 10, height: 10 }),
  ] }, {
    width: 40,
    height: 40,
  });
  assert.match(result, /<circle/);
  assert.match(result, /<rect/);
});

test('supports richer SVG elements, camel-case attributes, and style objects', () => {
  const result = compile(`svg(
    defs(linearGradient(stop(offset="0%", stopColor="#fff"), id="shine")),
    text(tspan("Matra", fontWeight=700), x=10, y=20),
    filter(feGaussianBlur(stdDeviation=3), id="blur"),
    width=120, height=40
  )`);
  assert.match(result, /stop-color="#fff"/);
  assert.match(result, /font-weight="700"/);
  assert.match(result, /<feGaussianBlur stdDeviation="3">/);

  const styled = toSVG(svgNode('svg', { style: { backgroundColor: '#fff', opacity: 0.8 } }));
  assert.match(styled, /style="background-color:#fff;opacity:0.8"/);
});

test('can format SVG for source views', () => {
  const result = compile('svg(circle(cx=5, cy=5, r=4), width=10, height=10)', { pretty: true });
  assert.match(result, /<svg[^>]*>\n  <circle/);
  assert.match(result, /\n<\/svg>$/);
});
