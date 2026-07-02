import type { MatraAST, MatraASTChild, MatraProps } from '@matra/core';
import type { SvgNode, SvgTag } from './types.js';
/** Pure AST builder used by Matra and JavaScript callers alike. */
export declare function svgNode(tag: SvgTag, props?: MatraProps, children?: MatraASTChild[]): SvgNode;
export declare function isSvgNode(node: MatraAST): node is SvgNode;
