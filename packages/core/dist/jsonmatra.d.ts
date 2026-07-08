import type { SourcePosition } from "./ast/types.js";
export type JSONMatraPrimitive = string | number | boolean | null | bigint | undefined;
export type MatraDocumentSource = {
    kind: "MatraDocumentSource";
    source: string;
};
export type MatraExpressionSource = {
    kind: "MatraExpressionSource";
    source: string;
};
export interface JSONMatraNode {
    tag: string;
    props: Record<string, JSONMatraValue>;
    children: JSONMatraValue[];
    position?: SourcePosition;
}
export type JSONMatraValue = JSONMatraPrimitive | JSONMatraValue[] | {
    [key: string]: JSONMatraValue;
} | JSONMatraNode | MatraDocumentSource | MatraExpressionSource;
type TemplateInput = TemplateStringsArray | string;
export declare function loadMatra(path: string): Promise<JSONMatraValue>;
export declare function normalizeMatra(input: unknown): JSONMatraValue;
export interface MatraFactory {
    (input: unknown): JSONMatraValue;
    doc(strings: TemplateInput, ...values: unknown[]): MatraDocumentSource;
    expr(strings: TemplateInput, ...values: unknown[]): MatraExpressionSource;
    ast(input: unknown): JSONMatraValue;
    tuple(tag: string, props?: unknown, children?: unknown[]): JSONMatraNode;
}
export declare const matra: MatraFactory;
export {};
