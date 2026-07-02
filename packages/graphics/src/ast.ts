import type { MatraAST, MatraASTChild, MatraProps } from '@matra/core';
import type { SvgNode, SvgTag } from './types.js';

/** Pure AST builder used by Matra and JavaScript callers alike. */
export function svgNode(
  tag: SvgTag,
  props: MatraProps = {},
  children: MatraASTChild[] = [],
): SvgNode {
  return { tag, props: { ...props }, children: [...children] };
}

export function isSvgNode(node: MatraAST): node is SvgNode {
  return SVG_TAG_SET.has(node.tag);
}

const SVG_TAG_SET = new Set<string>([
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
  'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'path', 'text',
  'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern',
]);
