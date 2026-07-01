import { parse, renderWith } from '@matra/core';
import { svgRenderer } from './render.js';
/** Compile Matra source directly to an SVG document. */
export function compile(source, options = {}) {
    const { parse: parseOptions, ...renderOptions } = options;
    return renderWith(svgRenderer, parse(source, parseOptions), renderOptions);
}
//# sourceMappingURL=compile.js.map