/**
 * Extract one Matra source fence from Markdown.
 *
 * Fences may use three or more backticks, so a Matra document can itself
 * contain ordinary Markdown code fences.
 */
export function extractMatraMarkdown(markdown, options = {}) {
    const pattern = /^[ \t]*(`{3,})([^\s`]+)[^\n]*\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm;
    const fences = [...markdown.matchAll(pattern)]
        .map(match => {
        const filename = match[2];
        const kind = filename.endsWith(".matra.ts")
            ? "matra.ts"
            : filename.endsWith(".matra")
                ? "matra"
                : undefined;
        return kind ? { filename, kind, source: match[3] } : undefined;
    })
        .filter((fence) => fence !== undefined);
    if (fences.length === 0) {
        throw new SyntaxError("Markdown must contain one `*.matra` or `*.matra.ts` fenced code block.");
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
//# sourceMappingURL=markdown.js.map