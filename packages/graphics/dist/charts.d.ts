import type { SvgNode } from "./types.js";
export interface ChartPoint {
    readonly x: number;
    readonly y: number;
}
export type ChartDomain = readonly [number, number];
export interface ChartOptions {
    width?: number;
    height?: number;
    xDomain?: ChartDomain;
    yDomain?: ChartDomain;
    title?: string;
    xLabel?: string;
    yLabel?: string;
    color?: string;
}
export interface ScatterPlotOptions extends ChartOptions {
    pointRadius?: number;
}
/** Build a single-series line chart as an SVG AST. Points connect in input order. */
export declare function lineChart(points: readonly ChartPoint[], options?: ChartOptions): SvgNode;
/** Build a single-series scatter plot as an SVG AST. */
export declare function scatterPlot(points: readonly ChartPoint[], options?: ScatterPlotOptions): SvgNode;
