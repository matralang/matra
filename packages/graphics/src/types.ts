import type { MatraAST, MatraProps } from '@matra/core';

export const SVG_TAGS = [
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
  'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'path', 'text',
  'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern',
] as const;

export type SvgTag = typeof SVG_TAGS[number];

export interface SvgNode extends MatraAST {
  tag: SvgTag;
  props: MatraProps;
}

export interface SVGRenderOptions {
  width?: number;
  height?: number;
  background?: string | null;
  title?: string;
  description?: string;
  attributes?: Record<string, string | number | boolean | null | undefined>;
}
