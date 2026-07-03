import type { MatraAST, MatraASTChild, MatraPropValue, MatraRenderer, MatraValue } from '@matra/core';
import { isSvgNode, svgNode } from './ast.js';
import type { SVGRenderOptions } from './types.js';

type Attribute = string | number | boolean | null | undefined;

export function toSVG(ast: MatraAST, options: SVGRenderOptions = {}): string {
  const root = ast.tag === 'svg' ? ast : wrapInSvg(ast, options);
  if (!isSvgNode(root)) throw new TypeError(`Unsupported SVG element: ${root.tag}`);

  const normalized = root.tag === 'svg' ? normalizeRoot(root, options) : root;
  const indent = options.pretty === true ? 2 : options.pretty || 0;
  return serializeNode(normalized, indent, 0);
}

export const svgRenderer: MatraRenderer<string, SVGRenderOptions> = {
  render: toSVG,
};

function wrapInSvg(ast: MatraAST, options: SVGRenderOptions): MatraAST {
  return svgNode('svg', {}, ast.tag === '$root' ? ast.children : [ast]);
}

function normalizeRoot(root: MatraAST, options: SVGRenderOptions): MatraAST {
  const width = options.width ?? scalarNumber(root.props.width) ?? 256;
  const height = options.height ?? scalarNumber(root.props.height) ?? 256;
  const attributes = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    ...root.props,
    ...options.attributes,
  };
  const children: MatraASTChild[] = [];
  const labelledBy: string[] = [];

  if (options.title) {
    labelledBy.push('matra-title');
    children.push(svgNode('title', { id: 'matra-title' }, [options.title]));
  }
  if (options.description) {
    labelledBy.push('matra-description');
    children.push(svgNode('desc', { id: 'matra-description' }, [options.description]));
  }
  if (options.background !== null && options.background !== undefined) {
    children.push(svgNode('rect', { width: '100%', height: '100%', fill: options.background }));
  }
  children.push(...root.children);

  if (labelledBy.length) {
    Object.assign(attributes, { role: 'img', 'aria-labelledby': labelledBy.join(' ') });
  }
  return { tag: 'svg', props: attributes, children };
}

function serializeNode(node: MatraAST, indent: number, depth: number): string {
  if (!isSvgNode(node)) throw new TypeError(`Unsupported SVG element: ${node.tag}`);
  const attributes = Object.entries(node.props)
    .map(([key, value]) => serializeAttribute(key, value))
    .join('');
  if (!indent || node.children.length === 0) {
    const children = node.children.map(child => serializeChild(child, indent, depth + 1)).join('');
    return `<${node.tag}${attributes}>${children}</${node.tag}>`;
  }

  const hasElementChild = node.children.some(isAst);
  if (!hasElementChild) {
    const children = node.children.map(child => serializeChild(child, indent, depth + 1)).join('');
    return `<${node.tag}${attributes}>${children}</${node.tag}>`;
  }
  const padding = ' '.repeat(indent * (depth + 1));
  const closingPadding = ' '.repeat(indent * depth);
  const children = node.children
    .map(child => `${padding}${serializeChild(child, indent, depth + 1)}`)
    .join('\n');
  return `<${node.tag}${attributes}>\n${children}\n${closingPadding}</${node.tag}>`;
}

function serializeChild(child: MatraASTChild, indent: number, depth: number): string {
  if (isAst(child)) return serializeNode(child, indent, depth);
  if (child === null) return '';
  if (typeof child === 'object') throw new TypeError('SVG children must be elements or scalar values');
  return escapeXML(child);
}

function serializeAttribute(key: string, value: MatraPropValue): string {
  if (value === null || value === false) return '';
  if (key === 'style' && isStyleRecord(value)) {
    return ` style="${escapeXML(serializeStyle(value))}"`;
  }
  if (typeof value === 'object') throw new TypeError(`SVG attribute ${key} must be a scalar value`);
  const normalized: Attribute = value === true ? key : value;
  return ` ${normalizeAttributeName(key)}="${escapeXML(normalized)}"`;
}

const ATTRIBUTE_ALIASES: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  xlinkHref: 'href',
};

const CASE_SENSITIVE_ATTRIBUTES = new Set([
  'viewBox', 'preserveAspectRatio',
  'gradientUnits', 'gradientTransform', 'spreadMethod',
  'patternUnits', 'patternContentUnits', 'patternTransform',
  'markerUnits', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient',
  'textLength', 'lengthAdjust', 'pathLength', 'startOffset',
  'attributeName', 'attributeType', 'calcMode', 'keyPoints', 'keyTimes', 'keySplines',
  'baseFrequency', 'numOctaves', 'seed', 'stitchTiles', 'surfaceScale',
  'diffuseConstant', 'specularConstant', 'specularExponent', 'kernelMatrix',
  'kernelUnitLength', 'preserveAlpha', 'targetX', 'targetY', 'edgeMode',
  'xChannelSelector', 'yChannelSelector', 'stdDeviation', 'tableValues',
]);

function normalizeAttributeName(key: string): string {
  if (CASE_SENSITIVE_ATTRIBUTES.has(key)) return key;
  return ATTRIBUTE_ALIASES[key] ?? key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

function isStyleRecord(value: MatraPropValue): value is Record<string, MatraValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isAst(value);
}

function serializeStyle(style: Record<string, MatraValue>): string {
  return Object.entries(style)
    .filter(([, value]) => value !== null && value !== false)
    .map(([key, value]) => {
      if (typeof value === 'object') throw new TypeError(`SVG style ${key} must be a scalar value`);
      return `${normalizeAttributeName(key)}:${String(value)}`;
    })
    .join(';');
}

function escapeXML(value: Attribute): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function scalarNumber(value: MatraPropValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isAst(value: MatraASTChild): value is MatraAST {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'tag' in value;
}
