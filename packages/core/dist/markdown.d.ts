/** A named fenced source block embedded in a Markdown document. */
export interface MarkdownFence {
    filename: string;
    source: string;
}
/** A Matra source block embedded in a Markdown document. */
export interface MatraMarkdownFence extends MarkdownFence {
    kind: "matra" | "matra.ts" | "matra.program";
}
export interface ExtractMatraMarkdownOptions {
    /** Select a fenced source by filename when the document has multiple entries. */
    entry?: string;
}
/**
 * Extract one Matra source fence from Markdown.
 *
 * Fences may use three or more backticks, so a Matra document can itself
 * contain ordinary Markdown code fences.
 */
export declare function extractMatraMarkdown(markdown: string, options?: ExtractMatraMarkdownOptions): MatraMarkdownFence;
/** Extract every named fence so documents can refer to code snippets by filename. */
export declare function extractMarkdownFences(markdown: string): MarkdownFence[];
