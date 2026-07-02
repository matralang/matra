export function isMatraAST(value) {
    return (isRecord(value) &&
        typeof value.tag === "string" &&
        isRecord(value.props) &&
        Array.isArray(value.children));
}
export function isMatraJSON(value) {
    return (Array.isArray(value) &&
        value.length === 3 &&
        typeof value[0] === "string" &&
        isRecord(value[1]) &&
        Array.isArray(value[2]));
}
/** Convert the object-shaped AST to compact MatraJSON. */
export function astToMatraJSON(ast) {
    return [
        ast.tag,
        cloneValue(ast.props),
        ast.children.map(childToJSON),
    ];
}
/** Convert compact MatraJSON to the object-shaped AST. */
export function matraJSONToAST(node) {
    const [tag, props, children] = node;
    return {
        tag,
        props: cloneValue(props),
        children: children.map(childToAST),
    };
}
function childToJSON(child) {
    return isMatraAST(child) ? astToMatraJSON(child) : cloneValue(child);
}
function childToAST(child) {
    return isMatraJSON(child) ? matraJSONToAST(child) : cloneValue(child);
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function cloneValue(value) {
    if (Array.isArray(value))
        return value.map(item => cloneValue(item));
    if (isRecord(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
    }
    return value;
}
//# sourceMappingURL=convert.js.map