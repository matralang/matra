import type { MatraAST, MatraProps } from '@matra/core';

export const SVG_TAGS = [
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
  'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'path',
  'text', 'tspan', 'textPath', 'image', 'foreignObject',
  'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern',
  'marker', 'filter', 'feBlend', 'feColorMatrix', 'feComponentTransfer',
  'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG',
  'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting',
  'feSpotLight', 'feTile', 'feTurbulence',
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
  /** Indent generated SVG for source views and downloads. */
  pretty?: boolean | number;
  attributes?: Record<string, string | number | boolean | null | undefined>;
}
