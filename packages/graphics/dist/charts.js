import { svgNode } from "./ast.js";
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 320;
const DEFAULT_COLOR = "#2563eb";
const TICK_COUNT = 5;
const MARGIN = { left: 56, right: 16, top: 32, bottom: 52 };
const GRID_COLOR = "#e5e7eb";
const AXIS_COLOR = "#6b7280";
const LABEL_COLOR = "#4b5563";
/** Build a single-series line chart as an SVG AST. Points connect in input order. */
export function lineChart(points, options = {}) {
    const frame = createChartFrame(points, options, 2, "Line chart");
    const coordinates = points
        .map(point => `${formatNumber(frame.x(point.x))},${formatNumber(frame.y(point.y))}`)
        .join(" ");
    const data = svgNode("polyline", {
        points: coordinates,
        fill: "none",
        stroke: frame.color,
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
    });
    return svgNode("svg", frame.props, [...frame.beforeData, data, ...frame.afterData]);
}
/** Build a single-series scatter plot as an SVG AST. */
export function scatterPlot(points, options = {}) {
    const frame = createChartFrame(points, options, 1, "Scatter plot");
    const pointRadius = options.pointRadius === undefined ? 4 : options.pointRadius;
    if (!Number.isFinite(pointRadius) || pointRadius <= 0) {
        throw new RangeError("pointRadius must be a positive finite number");
    }
    const data = points.map(point => svgNode("circle", {
        cx: frame.x(point.x),
        cy: frame.y(point.y),
        r: pointRadius,
        fill: frame.color,
    }));
    return svgNode("svg", frame.props, [...frame.beforeData, ...data, ...frame.afterData]);
}
function createChartFrame(points, options, minimumPoints, chartName) {
    if (!Array.isArray(points))
        throw new TypeError("points must be an array");
    if (points.length < minimumPoints) {
        throw new RangeError(`${chartName} requires at least ${minimumPoints} point(s)`);
    }
    for (const [index, point] of points.entries()) {
        if (point === null ||
            typeof point !== "object" ||
            Array.isArray(point) ||
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y)) {
            throw new TypeError(`Point at index ${index} must have finite numeric x and y values`);
        }
    }
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
        throw new TypeError("options must be an object");
    }
    const width = positiveDimension(options.width, DEFAULT_WIDTH, "width");
    const height = positiveDimension(options.height, DEFAULT_HEIGHT, "height");
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = height - MARGIN.top - MARGIN.bottom;
    if (plotWidth <= 0 || plotHeight <= 0) {
        throw new RangeError("Chart dimensions must be larger than the plot margins");
    }
    const xDomain = resolveDomain(points, "x", options.xDomain);
    const yDomain = resolveDomain(points, "y", options.yDomain);
    validateDomainContains(points, "x", xDomain);
    validateDomainContains(points, "y", yDomain);
    const x = (value) => MARGIN.left + ((value - xDomain.minimum) / xDomain.span) * plotWidth;
    const y = (value) => MARGIN.top + plotHeight - ((value - yDomain.minimum) / yDomain.span) * plotHeight;
    const color = options.color === undefined ? DEFAULT_COLOR : options.color;
    if (typeof color !== "string" || color.length === 0) {
        throw new TypeError("color must be a non-empty string");
    }
    for (const [name, label] of [
        ["title", options.title],
        ["xLabel", options.xLabel],
        ["yLabel", options.yLabel],
    ]) {
        if (label !== undefined && typeof label !== "string") {
            throw new TypeError(`${name} must be a string`);
        }
    }
    const plotBottom = MARGIN.top + plotHeight;
    const chartTitle = options.title || chartName;
    const beforeData = [];
    if (options.title) {
        beforeData.push(svgNode("title", {}, [options.title]), svgNode("text", {
            x: width / 2,
            y: 20,
            fontFamily: "sans-serif",
            fontSize: 14,
            fontWeight: 600,
            textAnchor: "middle",
        }, [options.title]));
    }
    beforeData.push(svgNode("g", { fill: "none", stroke: GRID_COLOR, strokeWidth: 1 }, [
        ...ticks(xDomain).map(value => svgNode("line", {
            x1: x(value),
            y1: MARGIN.top,
            x2: x(value),
            y2: plotBottom,
        })),
        ...ticks(yDomain).map(value => svgNode("line", {
            x1: MARGIN.left,
            y1: y(value),
            x2: MARGIN.left + plotWidth,
            y2: y(value),
        })),
    ]), svgNode("g", { fill: "none", stroke: AXIS_COLOR, strokeWidth: 1 }, [
        svgNode("line", {
            x1: MARGIN.left,
            y1: plotBottom,
            x2: MARGIN.left + plotWidth,
            y2: plotBottom,
        }),
        svgNode("line", {
            x1: MARGIN.left,
            y1: MARGIN.top,
            x2: MARGIN.left,
            y2: plotBottom,
        }),
    ]));
    const afterData = [
        svgNode("g", { fontFamily: "sans-serif", fontSize: 12, fill: LABEL_COLOR }, [
            ...ticks(xDomain).map(value => svgNode("text", {
                x: x(value),
                y: plotBottom + 18,
                textAnchor: "middle",
            }, [formatTick(value)])),
            ...ticks(yDomain).map(value => svgNode("text", {
                x: MARGIN.left - 8,
                y: y(value) + 4,
                textAnchor: "end",
            }, [formatTick(value)])),
            ...(options.xLabel
                ? [
                    svgNode("text", {
                        x: MARGIN.left + plotWidth / 2,
                        y: height - 6,
                        textAnchor: "middle",
                    }, [options.xLabel]),
                ]
                : []),
            ...(options.yLabel
                ? [
                    svgNode("text", {
                        x: 14,
                        y: MARGIN.top + plotHeight / 2,
                        transform: `rotate(-90 14 ${formatNumber(MARGIN.top + plotHeight / 2)})`,
                        textAnchor: "middle",
                    }, [options.yLabel]),
                ]
                : []),
        ]),
    ];
    return {
        props: {
            width,
            height,
            viewBox: `0 0 ${formatNumber(width)} ${formatNumber(height)}`,
            role: "img",
            "aria-label": chartTitle,
        },
        beforeData,
        afterData,
        color,
        x,
        y,
    };
}
function positiveDimension(value, fallback, name) {
    const dimension = value === undefined ? fallback : value;
    if (!Number.isFinite(dimension) || dimension <= 0) {
        throw new RangeError(`${name} must be a positive finite number`);
    }
    return dimension;
}
function resolveDomain(points, axis, requested) {
    if (requested !== undefined) {
        if (!Array.isArray(requested) ||
            requested.length !== 2 ||
            !Number.isFinite(requested[0]) ||
            !Number.isFinite(requested[1])) {
            throw new TypeError(`${axis}Domain must contain two finite numbers`);
        }
        return makeDomain(requested[0], requested[1], true, axis);
    }
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const point of points) {
        minimum = Math.min(minimum, point[axis]);
        maximum = Math.max(maximum, point[axis]);
    }
    const range = maximum - minimum;
    if (!Number.isFinite(range))
        return makeDomain(minimum, maximum, false, axis);
    const padding = range === 0 ? Math.max(Math.abs(minimum) * 0.05, 1) : range * 0.05;
    let lower = minimum - padding;
    let upper = maximum + padding;
    if (!Number.isFinite(lower))
        lower = minimum;
    if (!Number.isFinite(upper))
        upper = maximum;
    if (!Number.isFinite(upper - lower)) {
        lower = minimum;
        upper = maximum;
    }
    return makeDomain(lower, upper, false, axis);
}
function makeDomain(minimum, maximum, explicit, axis) {
    const span = maximum - minimum;
    if (!Number.isFinite(span) || span <= 0) {
        throw new RangeError(`${axis}Domain must have a finite minimum smaller than its maximum`);
    }
    return { minimum, maximum, span, explicit };
}
function validateDomainContains(points, axis, domain) {
    if (!domain.explicit)
        return;
    if (points.some(point => point[axis] < domain.minimum || point[axis] > domain.maximum)) {
        throw new RangeError(`All points must be within the explicit ${axis}Domain`);
    }
}
function ticks(domain) {
    return Array.from({ length: TICK_COUNT }, (_, index) => domain.minimum + (domain.span / (TICK_COUNT - 1)) * index);
}
function formatTick(value) {
    return formatNumber(value, 3);
}
function formatNumber(value, precision = 6) {
    const formatted = value.toPrecision(precision);
    const rounded = Number(formatted);
    if (!Number.isFinite(rounded))
        return String(value);
    return Object.is(rounded, -0) ? "0" : String(rounded);
}
//# sourceMappingURL=charts.js.map