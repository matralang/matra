/** A Matra source block embedded in a Markdown document. */
export interface MatraMarkdownFence {
    filename: string;
    kind: "matra" | "matra.ts";
    source: string;
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
