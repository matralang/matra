import { parse, renderWith, type ParseOptions } from '@matra/core';
import { svgRenderer } from './render.js';
import type { SVGRenderOptions } from './types.js';

export interface CompileOptions extends SVGRenderOptions {
  parse?: ParseOptions;
}

/** Compile Matra source directly to an SVG document. */
export function compile(source: string, options: CompileOptions = {}): string {
  const { parse: parseOptions, ...renderOptions } = options;
  return renderWith(svgRenderer, parse(source, parseOptions), renderOptions);
}
