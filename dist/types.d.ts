export type MatraPropertyValue = string | number | boolean | null;
export type MatraProperties = Record<string, MatraPropertyValue>;
export interface MatraElement {
    type: "element";
    tagName: string;
    properties?: MatraProperties;
    children?: MatraNode[];
}
export interface MatraText {
    type: "text";
    value: string;
}
export interface MatraComment {
    type: "comment";
    value: string;
}
export interface MatraRoot {
    type: "root";
    children: MatraNode[];
}
export type MatraNode = MatraElement | MatraText | MatraComment | MatraRoot;
export interface PositionPoint {
    line: number;
    column: number;
    offset?: number;
}
export interface Position {
    start: PositionPoint;
    end: PositionPoint;
}
export interface MdBaseNode {
    type: string;
    position?: Position;
    data?: Record<string, unknown>;
}
export interface TextNode extends MdBaseNode {
    type: "text";
    value: string;
}
export interface ParentNode extends MdBaseNode {
    children: MdNode[];
}
export interface ParagraphNode extends ParentNode {
    type: "paragraph";
}
export interface HeadingNode extends ParentNode {
    type: "heading";
    depth: number;
}
export interface EmphasisNode extends ParentNode {
    type: "emphasis";
}
export interface StrongNode extends ParentNode {
    type: "strong";
}
export interface BlockquoteNode extends ParentNode {
    type: "blockquote";
}
export interface LinkNode extends ParentNode {
    type: "link";
    url: string;
    title?: string;
}
export interface ImageNode extends MdBaseNode {
    type: "image";
    url: string;
    title?: string;
    alt?: string;
}
export interface ListNode extends MdBaseNode {
    type: "list";
    ordered?: boolean;
    start?: number;
    children: ListItemNode[];
}
export interface ListItemNode extends ParentNode {
    type: "listItem";
    checked?: boolean;
}
export interface CodeNode extends MdBaseNode {
    type: "code";
    lang?: string;
    meta?: string;
    value: string;
}
export interface ValueNode extends MdBaseNode {
    value: string;
}
export interface InlineCodeNode extends ValueNode {
    type: "inlineCode";
}
export interface InlineMathNode extends ValueNode {
    type: "inlineMath";
}
export interface MathNode extends ValueNode {
    type: "math";
}
export interface TableNode extends MdBaseNode {
    type: "table";
    children: TableRowNode[];
}
export interface TableRowNode extends MdBaseNode {
    type: "tableRow";
    children: TableCellNode[];
}
export interface TableCellNode extends ParentNode {
    type: "tableCell";
}
export interface VariableNode extends MdBaseNode {
    type: "variable";
    key: string;
}
export interface DirectiveNode extends ParentNode {
    type: "directive";
    name: string;
    args?: string[];
}
export interface ComponentNode extends ParentNode {
    type: "component";
    name: string;
    attrs: Record<string, string>;
}
export type MdNode = TextNode | ParagraphNode | HeadingNode | EmphasisNode | StrongNode | LinkNode | ImageNode | ListNode | ListItemNode | CodeNode | InlineCodeNode | BlockquoteNode | InlineMathNode | MathNode | TableNode | TableRowNode | TableCellNode | VariableNode | DirectiveNode | ComponentNode;
export interface MatradownDocument {
    filename?: string;
    frontmatter?: Record<string, unknown>;
    children: MdNode[];
}
export declare const MATRA_VERSION = "0.8.1";
