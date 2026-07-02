import { isMatraAST } from "./convert.js";
/** Depth-first traversal of AST nodes. Literal children are left untouched. */
export function visit(node, visitor) {
    walk(node, null, null, visitor);
}
function walk(node, parent, index, visitor) {
    visitor(node, { parent, index });
    node.children.forEach((child, childIndex) => {
        if (isMatraAST(child))
            walk(child, node, childIndex, visitor);
    });
}
/** Immutable bottom-up transformation. Returning null removes an AST child. */
export function transform(node, transformer) {
    return transformNode(node, null, null, transformer);
}
function transformNode(node, parent, index, transformer) {
    const children = node.children
        .map((child, childIndex) => isMatraAST(child)
        ? transformNode(child, node, childIndex, transformer)
        : child)
        .filter((child) => child !== null);
    const next = { tag: node.tag, props: { ...node.props }, children };
    const result = transformer(next, { parent, index });
    return result === undefined ? next : result;
}
//# sourceMappingURL=transform.js.map