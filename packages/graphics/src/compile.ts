import { evaluateStatic, parse, renderWith, staticValueToAST } from '@matra/core';
import { svgRenderer } from './render.js';
import type { SVGRenderOptions } from './types.js';

export type CompileOptions = SVGRenderOptions;

/** Compile Matra source directly to an SVG document. */
export function compile(source: string, options: CompileOptions = {}): string {
  const value = evaluateStatic(parse(source));
  if (value === undefined) throw new TypeError("Graphics source must have an output expression.");
  return renderWith(svgRenderer, staticValueToAST(value) as any, options);
}
