/**
 * Extract one Matra source fence from Markdown.
 *
 * Fences may use three or more backticks, so a Matra document can itself
 * contain ordinary Markdown code fences.
 */
export function extractMatraMarkdown(markdown, options = {}) {
    const fences = extractMarkdownFences(markdown)
        .map(fence => {
        const kind = fence.filename.endsWith(".matra.ts")
            ? "matra.ts"
            : fence.filename.endsWith(".matra.program")
                ? "matra.program"
                : fence.filename.endsWith(".matra")
                    ? "matra"
                    : undefined;
        return kind ? { ...fence, kind } : undefined;
    })
        .filter((fence) => fence !== undefined);
    if (fences.length === 0) {
        throw new SyntaxError("Markdown must contain one `*.matra`, `*.matra.ts`, or `*.matra.program` fenced code block.");
    }
    const fence = options.entry
        ? fences.find(candidate => candidate.filename === options.entry)
        : fences.length === 1
            ? fences[0]
            : undefined;
    if (!fence && options.entry) {
        throw new SyntaxError(`The Matra entry '${options.entry}' was not found in this Markdown document.`);
    }
    if (!fence) {
        throw new SyntaxError("Set an entry when Markdown contains multiple Matra code blocks.");
    }
    return fence;
}
/** Extract every named fence so documents can refer to code snippets by filename. */
export function extractMarkdownFences(markdown) {
    const pattern = /^[ \t]*(`{3,})([^\s`]+)[^\n]*\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm;
    return [...markdown.matchAll(pattern)].map(match => ({
        filename: match[2],
        source: match[3],
    }));
}
//# sourceMappingURL=markdown.js.map