import type { MatraAST, MatraRenderer } from '@matra/core';
import type { SVGRenderOptions } from './types.js';
export declare function toSVG(ast: MatraAST, options?: SVGRenderOptions): string;
export declare const svgRenderer: MatraRenderer<string, SVGRenderOptions>;
