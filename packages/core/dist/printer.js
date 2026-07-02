/** Serialize any Matra tree or value without applying domain semantics. */
export function printJSON(value, options = {}) {
    return JSON.stringify(value, null, options.pretty ? 2 : undefined);
}
//# sourceMappingURL=printer.js.map