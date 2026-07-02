import type { MatraAST } from "./ast/types.js";
/** Domain renderer implemented by packages such as HTML, Math, and Graphics. */
export interface MatraRenderer<Output, Options = undefined> {
    render(ast: MatraAST, options?: Options): Output;
}
/** Render a normalized Matra tree without coupling Core to an output domain. */
export declare function renderWith<Output, Options>(renderer: MatraRenderer<Output, Options>, ast: MatraAST, options?: Options): Output;
