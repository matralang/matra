import type { SVGRenderOptions } from './types.js';
export type CompileOptions = SVGRenderOptions;
/** Compile Matra source directly to an SVG document. */
export declare function compile(source: string, options?: CompileOptions): string;
