import { evaluateStatic, parse, renderWith, staticValueToAST } from '@matra/core';
import { svgRenderer } from './render.js';
/** Compile Matra source directly to an SVG document. */
export function compile(source, options = {}) {
    const value = evaluateStatic(parse(source));
    if (value === undefined)
        throw new TypeError("Graphics source must have an output expression.");
    return renderWith(svgRenderer, staticValueToAST(value), options);
}
//# sourceMappingURL=compile.js.map