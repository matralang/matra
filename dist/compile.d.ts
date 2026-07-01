import { type ParseOptions } from '@matra/core';
import type { SVGRenderOptions } from './types.js';
export interface CompileOptions extends SVGRenderOptions {
    parse?: ParseOptions;
}
/** Compile Matra source directly to an SVG document. */
export declare function compile(source: string, options?: CompileOptions): string;
