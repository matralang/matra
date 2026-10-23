import { DOMParser, NAMESPACE, type Element as XmlElement } from "@xmldom/xmldom"
import type {
  ContentMathMLApplication,
  ContentMathMLExpression,
  ContentMathMLNumber,
  ContentMathMLSymbol,
  MathJson,
  MathJsonFunction,
} from "./types.js"

const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML"
export const DEFAULT_OPENMATH_CDBASE = "http://www.openmath.org/cd"

const elementSymbols: Readonly<Record<string, readonly [string, string]>> = {
  plus: ["arith1", "plus"],
  times: ["arith1", "times"],
  minus: ["arith1", "minus"],
  divide: ["arith1", "divide"],
  power: ["arith1", "power"],
  root: ["arith1", "root"],
  abs: ["arith1", "abs"],
  sin: ["transc1", "sin"],
  cos: ["transc1", "cos"],
  tan: ["transc1", "tan"],
  exp: ["transc1", "exp"],
  ln: ["transc1", "ln"],
  eq: ["relation1", "eq"],
  neq: ["relation1", "neq"],
  lt: ["relation1", "lt"],
  gt: ["relation1", "gt"],
  leq: ["relation1", "leq"],
  geq: ["relation1", "geq"],
  pi: ["nums1", "pi"],
  exponentiale: ["nums1", "e"],
  imaginaryi: ["nums1", "i"],
  infinity: ["nums1", "infinity"],
  true: ["logic1", "true"],
  false: ["logic1", "false"],
}

const mathJsonHeads: Readonly<Record<string, string>> = {
  "arith1.plus": "Add",
  "arith1.times": "Multiply",
  "arith1.minus": "Subtract",
  "arith1.unary_minus": "Negate",
  "arith1.divide": "Divide",
  "arith1.power": "Power",
  "arith1.root": "Root",
  "arith1.abs": "Abs",
  "nums1.rational": "Rational",
  "transc1.sin": "Sin",
  "transc1.cos": "Cos",
  "transc1.tan": "Tan",
  "transc1.exp": "Exp",
  "transc1.ln": "Ln",
  "relation1.eq": "Equal",
  "relation1.neq": "NotEqual",
  "relation1.lt": "Less",
  "relation1.gt": "Greater",
  "relation1.leq": "LessEqual",
  "relation1.geq": "GreaterEqual",
}

const constantMathJson: Readonly<Record<string, MathJson>> = {
  "nums1.pi": "Pi",
  "nums1.e": "ExponentialE",
  "nums1.i": "ImaginaryUnit",
  "nums1.infinity": "Infinity",
  "logic1.true": true,
  "logic1.false": false,
}

const symbolsByMathJsonHead: Readonly<Record<string, readonly [string, string]>> = {
  Add: ["arith1", "plus"],
  Multiply: ["arith1", "times"],
  Subtract: ["arith1", "minus"],
  Negate: ["arith1", "unary_minus"],
  Divide: ["arith1", "divide"],
  Power: ["arith1", "power"],
  Root: ["arith1", "root"],
  Abs: ["arith1", "abs"],
  Rational: ["nums1", "rational"],
  Sin: ["transc1", "sin"],
  Cos: ["transc1", "cos"],
  Tan: ["transc1", "tan"],
  Exp: ["transc1", "exp"],
  Ln: ["transc1", "ln"],
  Equal: ["relation1", "eq"],
  NotEqual: ["relation1", "neq"],
  Less: ["relation1", "lt"],
  Greater: ["relation1", "gt"],
  LessEqual: ["relation1", "leq"],
  GreaterEqual: ["relation1", "geq"],
}

/** Parse the supported MathML 3 Content MathML subset into a CD-aware expression tree. */
export function parseContentMathML(source: string): ContentMathMLExpression {
  if (/<!DOCTYPE/i.test(source)) {
    throw new SyntaxError("Content MathML doctype declarations are not supported")
  }

  try {
    const document = new DOMParser({
      onError: (level, message) => {
        if (level !== "warning") throw new SyntaxError(message)
      },
    }).parseFromString(source, "application/xml")
    const root = document.documentElement
    if (root === null) throw new SyntaxError("XML document has no root element")
    assertMathMLElement(root, "math")
    assertAttributes(root, [])
    const children = expressionChildren(root)
    if (children.length !== 1) {
      throw new SyntaxError("Content MathML math element must contain exactly one expression")
    }
    return parseExpression(children[0])
  } catch (error) {
    if (error instanceof SyntaxError && error.message.startsWith("Invalid Content MathML:"))
      throw error
    const message = error instanceof Error ? error.message : String(error)
    throw new SyntaxError(`Invalid Content MathML: ${message}`, { cause: error })
  }
}

/** Normalize the supported Content MathML subset and serialize it as Strict Content MathML. */
export function normalizeContentMathML(source: string): string {
  return serializeContentMathML(parseContentMathML(source))
}

/** Serialize a CD-aware expression tree as Strict Content MathML. */
export function serializeContentMathML(expression: ContentMathMLExpression): string {
  return `<math xmlns="${MATHML_NAMESPACE}">${serializeExpression(expression)}</math>`
}

/** Convert supported OpenMath symbols and exact number forms to engine-interchange MathJSON. */
export function contentMathMLToMathJson(expression: ContentMathMLExpression): MathJson {
  if (expression.kind === "identifier") return expression.name
  if (expression.kind === "number") return numberToMathJson(expression)
  if (expression.kind === "symbol") return symbolToMathJson(expression)

  const head = applicationHead(expression.operator)
  const operands = expression.operands.map(contentMathMLToMathJson)
  return [head, ...operands] as MathJsonFunction
}

/** Convert supported MathJSON back to the CD-aware semantic expression tree. */
export function mathJsonToContentMathML(expression: MathJson): ContentMathMLExpression {
  if (typeof expression === "number") {
    if (!Number.isFinite(expression)) throw new TypeError("MathJSON number must be finite")
    const type = Number.isSafeInteger(expression) ? "integer" : "real"
    return { kind: "number", type, value: Object.is(expression, -0) ? "-0" : String(expression) }
  }
  if (typeof expression === "boolean") {
    return makeSymbol("logic1", expression ? "true" : "false")
  }
  if (typeof expression === "string") {
    const constant = Object.entries(constantMathJson).find(([, value]) => value === expression)
    if (constant !== undefined) {
      const [cd, name] = constant[0].split(".")
      return makeSymbol(cd, name)
    }
    return { kind: "identifier", name: expression }
  }
  if (!Array.isArray(expression))
    throw new TypeError("Unsupported MathJSON value for Content MathML")

  const [head, ...operands] = expression
  if (typeof head !== "string" || !Object.hasOwn(symbolsByMathJsonHead, head)) {
    throw new TypeError(`Unsupported MathJSON operation for Content MathML: ${String(head)}`)
  }
  const [cd, name] = symbolsByMathJsonHead[head]
  return {
    kind: "application",
    operator: makeSymbol(cd, name),
    operands: operands.map(operand => mathJsonToContentMathML(operand)),
  }
}

function parseExpression(element: XmlElement): ContentMathMLExpression {
  assertMathMLNamespace(element)
  switch (xmlLocalName(element)) {
    case "ci":
      assertAttributes(element, [])
      return { kind: "identifier", name: readNormalizedText(element) }
    case "cn":
      return parseNumber(element)
    case "csymbol":
      return parseSymbol(element)
    case "apply":
      return parseApplication(element)
    case "sep":
      throw new SyntaxError("Content MathML sep is only supported inside rational cn")
    default: {
      const name = xmlLocalName(element)
      const mapping = elementSymbols[name]
      if (mapping === undefined) {
        throw new SyntaxError(`Unsupported Content MathML element: ${name}`)
      }
      assertAttributes(element, [])
      if (elementChildren(element).length > 0 || readText(element).trim() !== "") {
        throw new SyntaxError(`Content MathML operator ${name} must be empty`)
      }
      return makeSymbol(mapping[0], mapping[1])
    }
  }
}

function parseNumber(element: XmlElement): ContentMathMLExpression {
  const type = element.getAttribute("type") || "real"
  if (type === "rational") {
    assertAttributes(element, ["type"])
    const [numeratorText, denominatorText] = rationalParts(element)
    const numerator = parseInteger(numeratorText, "rational numerator")
    const denominator = parseInteger(denominatorText, "rational denominator")
    if (BigInt(denominator.value) === 0n)
      throw new SyntaxError("Rational denominator must not be zero")
    return {
      kind: "application",
      operator: makeSymbol("nums1", "rational"),
      operands: [numerator, denominator],
    }
  }

  if (type !== "integer" && type !== "real" && type !== "double") {
    throw new SyntaxError(`Unsupported Content MathML cn type: ${type}`)
  }
  assertAttributes(element, ["type"])
  if (elementChildren(element).length > 0) {
    throw new SyntaxError("Content MathML cn must contain text only")
  }
  const value = normalizeWhitespace(readText(element))
  if (!isValidNumber(value, type)) {
    throw new SyntaxError(`Invalid ${type} Content MathML number: ${value}`)
  }
  return { kind: "number", type, value }
}

function parseInteger(value: string, label: string): ContentMathMLNumber {
  const normalized = normalizeWhitespace(value)
  if (!/^[+-]?\d+$/.test(normalized)) throw new SyntaxError(`Invalid ${label}: ${normalized}`)
  return { kind: "number", type: "integer", value: normalized }
}

function rationalParts(element: XmlElement): [string, string] {
  const parts = [""]
  let separatorCount = 0
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const node = element.childNodes.item(index)
    if (node === null) continue
    if (node.nodeType === 1 && xmlLocalName(node as XmlElement) === "sep") {
      assertMathMLNamespace(node as XmlElement)
      assertAttributes(node as XmlElement, [])
      if (++separatorCount > 1) throw new SyntaxError("Rational cn must contain exactly one sep")
      parts.push("")
    } else if (node.nodeType === 3 || node.nodeType === 4) {
      parts[parts.length - 1] += node.nodeValue ?? ""
    } else if (node.nodeType !== 8) {
      throw new SyntaxError("Rational cn must contain two integer text values separated by sep")
    }
  }
  if (separatorCount !== 1) throw new SyntaxError("Rational cn must contain exactly one sep")
  return [parts[0], parts[1]]
}

function parseSymbol(element: XmlElement): ContentMathMLSymbol {
  assertAttributes(element, ["cd"])
  const cd = element.getAttribute("cd")?.trim()
  if (!cd) throw new SyntaxError("Content MathML csymbol requires a non-empty cd attribute")
  if (elementChildren(element).length > 0) {
    throw new SyntaxError("Content MathML csymbol must contain text only")
  }
  const name = readNormalizedText(element)
  if (!name) throw new SyntaxError("Content MathML csymbol requires a non-empty symbol name")
  return {
    kind: "symbol",
    cdbase: DEFAULT_OPENMATH_CDBASE,
    cd,
    name,
  }
}

function parseApplication(element: XmlElement): ContentMathMLApplication {
  assertAttributes(element, [])
  const children = expressionChildren(element)
  if (children.length === 0) throw new SyntaxError("Content MathML apply requires an operator")

  const operatorElement = children[0]
  const operatorName = xmlLocalName(operatorElement)
  const specialRoot = operatorName === "root" && operatorElement.namespaceURI === MATHML_NAMESPACE
  if (specialRoot) {
    assertAttributes(operatorElement, [])
    if (elementChildren(operatorElement).length > 0 || readText(operatorElement).trim() !== "") {
      throw new SyntaxError("Content MathML root operator must be empty")
    }
    const operands = children.slice(1)
    let degree: ContentMathMLExpression = { kind: "number", type: "integer", value: "2" }
    const degreeIndex = operands.findIndex(child => xmlLocalName(child) === "degree")
    if (degreeIndex >= 0) {
      const degreeElement = operands.splice(degreeIndex, 1)[0]
      assertMathMLElement(degreeElement, "degree")
      assertAttributes(degreeElement, [])
      const degreeChildren = expressionChildren(degreeElement)
      if (degreeChildren.length !== 1)
        throw new SyntaxError("root degree must contain exactly one expression")
      degree = parseExpression(degreeChildren[0])
    }
    if (operands.length !== 1) throw new SyntaxError("Content MathML root requires one radicand")
    const application: ContentMathMLApplication = {
      kind: "application",
      operator: makeSymbol("arith1", "root"),
      operands: [parseExpression(operands[0]), degree],
    }
    validateArity(application)
    return application
  }

  const application: ContentMathMLApplication = {
    kind: "application",
    operator: parseExpression(operatorElement),
    operands: children.slice(1).map(parseExpression),
  }
  if (application.operator.kind === "symbol" && elementSymbols[operatorName] !== undefined) {
    const [cd, name] = elementSymbols[operatorName]
    if (cd === "arith1" && name === "minus" && application.operands.length === 1) {
      application.operator = makeSymbol("arith1", "unary_minus")
    }
  }
  validateArity(application)
  return application
}

function validateArity(application: ContentMathMLApplication): void {
  const operator = application.operator
  if (operator.kind !== "symbol" || operator.cdbase !== DEFAULT_OPENMATH_CDBASE) return
  const key = `${operator.cd}.${operator.name}`
  const count = application.operands.length
  const valid =
    key === "arith1.plus" || key === "arith1.times"
      ? true
      : key === "arith1.minus" ||
          key === "arith1.divide" ||
          key === "arith1.power" ||
          key === "arith1.root" ||
          key === "relation1.neq"
        ? count === 2
        : key === "arith1.unary_minus" || key === "arith1.abs" || key.startsWith("transc1.")
          ? count === 1
          : key === "relation1.eq" ||
              key === "relation1.lt" ||
              key === "relation1.gt" ||
              key === "relation1.leq" ||
              key === "relation1.geq"
            ? count >= 2
            : constantMathJson[key] === undefined
  if (!valid) throw new SyntaxError(`Invalid operand count for ${key}: ${count}`)
}

function expressionChildren(element: XmlElement): XmlElement[] {
  const children: XmlElement[] = []
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const node = element.childNodes.item(index)
    if (node === null) continue
    if (node.nodeType === 1) children.push(node as XmlElement)
    else if ((node.nodeType === 3 || node.nodeType === 4) && (node.nodeValue ?? "").trim() !== "") {
      throw new SyntaxError(`Unexpected text in Content MathML ${xmlLocalName(element)}`)
    } else if (node.nodeType !== 8 && node.nodeType !== 3 && node.nodeType !== 4) {
      throw new SyntaxError(`Unsupported XML node in Content MathML ${xmlLocalName(element)}`)
    }
  }
  return children
}

function elementChildren(element: XmlElement): XmlElement[] {
  const children: XmlElement[] = []
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const node = element.childNodes.item(index)
    if (node === null) continue
    if (node.nodeType === 1) children.push(node as XmlElement)
  }
  return children
}

function assertMathMLElement(element: XmlElement, expectedName: string): void {
  assertMathMLNamespace(element)
  const name = xmlLocalName(element)
  if (name !== expectedName) {
    throw new SyntaxError(`Expected MathML <${expectedName}> root, got <${name}>`)
  }
}

function assertMathMLNamespace(element: XmlElement): void {
  if (element.namespaceURI !== MATHML_NAMESPACE) {
    throw new SyntaxError(`Element <${xmlLocalName(element)}> must use the MathML namespace`)
  }
}

function assertAttributes(element: XmlElement, allowed: string[]): void {
  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes.item(index)
    if (attribute === null) continue
    if (attribute.namespaceURI === NAMESPACE.XMLNS) continue
    if (attribute.namespaceURI !== null || !allowed.includes(attribute.name)) {
      throw new SyntaxError(`Unsupported attribute ${attribute.name} on <${xmlLocalName(element)}>`)
    }
  }
}

function readText(element: XmlElement): string {
  let text = ""
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const node = element.childNodes.item(index)
    if (node === null) continue
    if (node.nodeType === 3 || node.nodeType === 4) text += node.nodeValue ?? ""
    else if (node.nodeType !== 8 && node.nodeType !== 1) {
      throw new SyntaxError(`Unsupported XML node in <${xmlLocalName(element)}>`)
    }
  }
  return text
}

function xmlLocalName(element: XmlElement): string {
  return element.localName ?? element.nodeName
}

function readNormalizedText(element: XmlElement): string {
  return normalizeWhitespace(readText(element))
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function isValidNumber(value: string, type: ContentMathMLNumber["type"]): boolean {
  if (type === "integer") return /^[+-]?\d+$/.test(value)
  if (type === "real")
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && Number.isFinite(Number(value))
  if (value === "INF" || value === "-INF" || value === "NaN") return true
  return (
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value))
  )
}

function makeSymbol(cd: string, name: string): ContentMathMLSymbol {
  return { kind: "symbol", cdbase: DEFAULT_OPENMATH_CDBASE, cd, name }
}

function serializeExpression(expression: ContentMathMLExpression): string {
  switch (expression.kind) {
    case "identifier":
      return `<ci>${escapeXml(expression.name)}</ci>`
    case "number":
      if (!isValidNumber(expression.value, expression.type)) {
        throw new TypeError(`Invalid ${expression.type} Content MathML number: ${expression.value}`)
      }
      return `<cn type="${expression.type}">${escapeXml(expression.value)}</cn>`
    case "symbol":
      if (expression.cdbase !== DEFAULT_OPENMATH_CDBASE) {
        throw new TypeError(
          `Cannot serialize non-default cdbase without a cdgroup: ${expression.cdbase}`,
        )
      }
      return `<csymbol cd="${escapeXml(expression.cd)}">${escapeXml(expression.name)}</csymbol>`
    case "application":
      return `<apply>${serializeExpression(expression.operator)}${expression.operands.map(serializeExpression).join("")}</apply>`
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function numberToMathJson(number: ContentMathMLNumber): number {
  const value = Number(number.value)
  if (!Number.isFinite(value) || (number.type === "integer" && !Number.isSafeInteger(value))) {
    throw new TypeError(`Number cannot be represented losslessly in MathJSON: ${number.value}`)
  }
  return value
}

function symbolToMathJson(symbol: ContentMathMLSymbol): MathJson {
  if (symbol.cdbase !== DEFAULT_OPENMATH_CDBASE) throw unsupportedSymbol(symbol)
  const key = `${symbol.cd}.${symbol.name}`
  if (Object.hasOwn(constantMathJson, key)) return constantMathJson[key]
  if (Object.hasOwn(mathJsonHeads, key)) return mathJsonHeads[key]
  throw unsupportedSymbol(symbol)
}

function applicationHead(operator: ContentMathMLExpression): string {
  if (operator.kind === "identifier") return operator.name
  if (operator.kind === "symbol") {
    const converted = symbolToMathJson(operator)
    if (typeof converted === "string") return converted
  }
  throw new TypeError("MathJSON application operator must be a supported symbol or identifier")
}

function unsupportedSymbol(symbol: ContentMathMLSymbol): TypeError {
  return new TypeError(
    `Unsupported Content Dictionary symbol: ${symbol.cdbase}/${symbol.cd}#${symbol.name}`,
  )
}
