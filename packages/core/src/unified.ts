/** Experimental parser and static evaluator for the unified Matra syntax. */

export type UnifiedScalar = string | number | boolean | null
export type UnifiedExpression =
  | { kind: "literal", value: UnifiedScalar }
  | { kind: "array", items: UnifiedExpression[] }
  | { kind: "object", entries: { key: string, value: UnifiedExpression }[] }
  | { kind: "reference", name: string }
  | { kind: "member", object: UnifiedExpression, name: string }
  | { kind: "call", callee: UnifiedExpression, arguments: UnifiedExpression[] }
  | { kind: "binary", operator: string, left: UnifiedExpression, right: UnifiedExpression }
  | { kind: "node", tag: string, classes: string[], attributes: { key: string, value: UnifiedExpression }[], body: UnifiedStatement[] }

export type UnifiedStatement =
  | { kind: "expression", expression: UnifiedExpression }
  | { kind: "let", name: string, value: UnifiedExpression }
  | { kind: "return", value: UnifiedExpression }
  | { kind: "if", condition: UnifiedExpression, thenBody: UnifiedStatement[], elseBody: UnifiedStatement[] }
  | { kind: "for", name: string, iterable: UnifiedExpression, body: UnifiedStatement[] }
  | { kind: "fn", name: string, parameters: string[], body: UnifiedStatement[] }

export interface UnifiedModule {
  kind: "module"
  statements: UnifiedStatement[]
}

export interface StaticNode {
  tag: string
  props: Record<string, StaticValue>
  children: StaticValue[]
}

export type StaticValue = UnifiedScalar | StaticValue[] | { [key: string]: StaticValue } | StaticNode

export interface StaticToASTNode {
  tag: string
  props: Record<string, StaticValue>
  children: (StaticToASTNode | StaticValue)[]
}

export class UnifiedSyntaxError extends SyntaxError {}
export class EvaluationRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EvaluationRequiredError"
  }
}

type Token = { value: string, offset: number, kind: "word" | "string" | "symbol" | "newline" | "eof" }

export function parseUnified(source: string): UnifiedModule {
  const parser = new UnifiedParser(tokenize(source))
  return parser.module()
}

/** Evaluate the static subset only. References may use preceding static `let`s. */
export function evaluateStatic(module: UnifiedModule): StaticValue | undefined {
  const scope: Record<string, StaticValue> = {}
  let output: StaticValue | undefined
  for (const statement of module.statements) {
    if (statement.kind === "let") scope[statement.name] = evaluateExpression(statement.value, scope)
    else if (statement.kind === "expression") output = evaluateExpression(statement.expression, scope)
    else throw new EvaluationRequiredError(`Static evaluation does not execute ${statement.kind} statements.`)
  }
  return output
}

/** Evaluate declarations, control flow, calls, and document bodies in TypeScript. */
export function evaluateUnified(module: UnifiedModule): StaticValue | undefined {
  const scope: Record<string, any> = {}
  const run = (statements: UnifiedStatement[]): any => { let output; for (const statement of statements) {
    if (statement.kind === "let") scope[statement.name] = expression(statement.value)
    else if (statement.kind === "fn") scope[statement.name] = (...args: any[]) => { const saved = { ...scope }; statement.parameters.forEach((name, index) => { scope[name] = args[index] }); const result = run(statement.body); Object.assign(scope, saved); return result?.return ?? result }
    else if (statement.kind === "return") return { return: expression(statement.value) }
    else if (statement.kind === "if") { const result = run(expression(statement.condition) ? statement.thenBody : statement.elseBody); if (result?.return !== undefined) return result; output = result }
    else if (statement.kind === "for") { const values = expression(statement.iterable); if (!Array.isArray(values)) throw new TypeError("for requires an array"); const results = []; for (const value of values) { scope[statement.name] = value; const result = run(statement.body); if (result?.return !== undefined) return result; results.push(result) } output = results }
    else output = expression(statement.expression)
  } return output }
  const expression = (value: UnifiedExpression): any => {
    if (value.kind === "literal") return value.value
    if (value.kind === "array") return value.items.map(expression)
    if (value.kind === "object") return Object.fromEntries(value.entries.map(entry => [entry.key, expression(entry.value)]))
    if (value.kind === "reference") { if (!(value.name in scope)) throw new ReferenceError(`Unknown name: ${value.name}`); return scope[value.name] }
    if (value.kind === "member") return expression(value.object)?.[value.name]
    if (value.kind === "call") { const callee = expression(value.callee); if (typeof callee !== "function") throw new TypeError("Call target is not a function"); return callee(...value.arguments.map(expression)) }
    if (value.kind === "binary") { const left = expression(value.left); const right = expression(value.right); return ({ "+": () => left + right, "-": () => left - right, "*": () => left * right, "/": () => left / right, "==": () => left === right, "!=": () => left !== right, "<": () => left < right, "<=": () => left <= right, ">": () => left > right, ">=": () => left >= right } as Record<string, () => unknown>)[value.operator]() }
    const props = Object.fromEntries(value.attributes.map(attribute => [attribute.key, expression(attribute.value)])); if (value.classes.length) props.class = value.classes.join(" "); const children: any[] = []; for (const statement of value.body) { const result = run([statement]); if (result?.return !== undefined) return result; if (statement.kind === "expression") children.push(result); else if (statement.kind === "if" && result !== undefined) children.push(result); else if (statement.kind === "for") children.push(...result.filter(item => item !== undefined)) } return { tag: value.tag, props, children }
  }
  return run(module.statements)
}

/** Convert a statically evaluated document node to the renderer's tree shape. */
export function staticValueToAST(value: StaticValue): StaticToASTNode {
  if (!isStaticNode(value)) throw new TypeError("A document renderer requires a static Matra node output.")
  return {
    tag: value.tag,
    props: value.props,
    children: value.children.map(child => isStaticNode(child) ? staticValueToAST(child) : child),
  }
}

function isStaticNode(value: StaticValue): value is StaticNode {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    typeof (value as StaticNode).tag === "string" &&
    typeof (value as StaticNode).props === "object" &&
    Array.isArray((value as StaticNode).children)
}

function evaluateExpression(expression: UnifiedExpression, scope: Record<string, StaticValue>): StaticValue {
  switch (expression.kind) {
    case "literal": return expression.value
    case "array": return expression.items.map(item => evaluateExpression(item, scope))
    case "object": return Object.fromEntries(expression.entries.map(entry => [entry.key, evaluateExpression(entry.value, scope)]))
    case "reference":
      if (Object.hasOwn(scope, expression.name)) return scope[expression.name]
      throw new EvaluationRequiredError(`Static evaluation requires a value for '${expression.name}'.`)
    case "member":
    case "call":
    case "binary":
      throw new EvaluationRequiredError(`Static evaluation does not execute ${expression.kind} expressions.`)
    case "node": {
      const props = Object.fromEntries(expression.attributes.map(attribute => [attribute.key, evaluateExpression(attribute.value, scope)]))
      if (expression.classes.length) props.class = expression.classes.join(" ")
      const children: StaticValue[] = []
      for (const statement of expression.body) {
        if (statement.kind === "let") scope[statement.name] = evaluateExpression(statement.value, scope)
        else if (statement.kind === "expression") children.push(evaluateExpression(statement.expression, scope))
        else throw new EvaluationRequiredError(`Static evaluation does not execute ${statement.kind} statements.`)
      }
      return { tag: expression.tag, props, children }
    }
  }
}

class UnifiedParser {
  private index = 0
  constructor(private readonly tokens: Token[]) {}

  module(): UnifiedModule {
    const statements = this.statements("eof")
    this.expect("eof")
    return { kind: "module", statements }
  }

  private statements(end: string): UnifiedStatement[] {
    const result: UnifiedStatement[] = []
    this.separators()
    while (!this.at(end)) {
      result.push(this.statement())
      if (!this.at(end) && !this.separators()) this.fail("Expected a newline or ';' between expressions")
    }
    return result
  }

  private statement(): UnifiedStatement {
    if (this.at("let")) {
      this.next()
      const name = this.word("Expected a variable name after 'let'")
      this.expect("=")
      return { kind: "let", name, value: this.expression() }
    }
    if (this.at("return")) { this.next(); return { kind: "return", value: this.expression() } }
    if (this.at("if")) {
      this.next(); this.expect("("); const condition = this.expression(); this.expect(")")
      const thenBody = this.block(); const elseBody = this.at("else") ? (this.next(), this.block()) : []
      return { kind: "if", condition, thenBody, elseBody }
    }
    if (this.at("for")) {
      this.next(); this.expect("("); const name = this.word("Expected a loop variable"); this.expect("in")
      const iterable = this.expression(); this.expect(")"); return { kind: "for", name, iterable, body: this.block() }
    }
    if (this.at("fn")) {
      this.next(); const name = this.word("Expected a function name"); this.expect("(")
      const parameters = this.list(")", () => this.word("Expected a parameter name")); this.expect(")")
      return { kind: "fn", name, parameters, body: this.block() }
    }
    return { kind: "expression", expression: this.expression() }
  }

  private block(): UnifiedStatement[] { this.expect("{"); const body = this.statements("}"); this.expect("}"); return body }

  private expression(): UnifiedExpression { return this.binary(0) }
  private binary(minimum: number): UnifiedExpression {
    let expression = this.primary()
    while (this.at(".")) {
      this.next()
      expression = { kind: "member", object: expression, name: this.word("Expected a member name after '.'") }
    }
    if (this.at("(")) {
      this.next()
      const args = this.list(")", () => this.expression())
      this.expect(")")
      expression = { kind: "call", callee: expression, arguments: args }
    }
    const precedence: Record<string, number> = { "==": 1, "!=": 1, "<": 2, "<=": 2, ">": 2, ">=": 2, "+": 3, "-": 3, "*": 4, "/": 4 }
    while ((precedence[this.peek().value] ?? 0) >= minimum && (precedence[this.peek().value] ?? 0) > 0) {
      const operator = this.next().value
      expression = { kind: "binary", operator, left: expression, right: this.binary(precedence[operator] + 1) }
    }
    return expression
  }

  private primary(): UnifiedExpression {
    const token = this.peek()
    if (token.kind === "string") return { kind: "literal", value: this.next().value }
    if (token.value === "true" || token.value === "false") { this.next(); return { kind: "literal", value: token.value === "true" } }
    if (token.value === "null") { this.next(); return { kind: "literal", value: null } }
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(token.value)) { this.next(); return { kind: "literal", value: Number(token.value) } }
    if (token.value === "[") {
      this.next(); const items = this.list("]", () => this.expression()); this.expect("]")
      return { kind: "array", items }
    }
    if (token.value === "{") {
      this.next(); const entries = this.list("}", () => { const key = this.key(); this.expect(":"); return { key, value: this.expression() } }); this.expect("}")
      return { kind: "object", entries }
    }
    const first = this.word("Expected an expression")
    const names = [first]
    while (this.at(".") && this.peek(1).kind === "word" && this.nodeFollowsDottedName()) { this.next(); names.push(this.word("Expected a class name")) }
    if (this.at("{") || (this.at("(") && this.nodeHasBody())) return this.node(first, names.slice(1))
    let result: UnifiedExpression = { kind: "reference", name: first }
    for (const name of names.slice(1)) result = { kind: "member", object: result, name }
    return result
  }

  private node(tag: string, classes: string[]): UnifiedExpression {
    const attributes: { key: string, value: UnifiedExpression }[] = []
    if (this.at("(")) {
      this.next()
      if (!this.at(")")) {
        do { const key = this.word("Expected an attribute name"); this.expect("="); attributes.push({ key, value: this.expression() }) } while (this.consume(","))
      }
      this.expect(")")
    }
    this.expect("{")
    const body = this.statements("}")
    this.expect("}")
    return { kind: "node", tag, classes: [...new Set(classes)], attributes, body }
  }

  private nodeFollowsDottedName(): boolean {
    let cursor = this.index
    while (this.tokens[cursor]?.value === "." && this.tokens[cursor + 1]?.kind === "word") cursor += 2
    return this.tokens[cursor]?.value === "{" || this.tokens[cursor]?.value === "("
  }
  private nodeHasBody(): boolean {
    let depth = 0
    for (let cursor = this.index; cursor < this.tokens.length; cursor++) {
      const value = this.tokens[cursor].value
      if (value === "(") depth++
      if (value === ")" && --depth === 0) return this.tokens[cursor + 1]?.value === "{"
    }
    return false
  }
  private list(end: string, item: () => any): any[] {
    const values = []
    this.inline()
    if (this.at(end)) return values
    do { this.inline(); values.push(item()); this.inline() } while (this.consume(","))
    return values
  }
  private key(): string { return this.peek().kind === "string" ? this.next().value : this.word("Expected an object key") }
  private separators(): boolean { let consumed = false; while (this.at("newline") || this.at(";")) { this.next(); consumed = true } return consumed }
  private inline(): void { while (this.at("newline")) this.next() }
  private word(message: string): string { if (this.peek().kind !== "word") this.fail(message); return this.next().value }
  private consume(value: string): boolean { if (!this.at(value)) return false; this.next(); return true }
  private expect(value: string): void { if (!this.consume(value)) this.fail(`Expected '${value}'`) }
  private at(value: string): boolean { const token = this.peek(); return value === "eof" ? token.kind === "eof" : value === "newline" ? token.kind === "newline" : token.value === value }
  private peek(lookahead = 0): Token { return this.tokens[this.index + lookahead] ?? this.tokens.at(-1)! }
  private next(): Token { return this.tokens[this.index++] }
  private fail(message: string): never { const token = this.peek(); throw new UnifiedSyntaxError(`${message} at offset ${token.offset}.`) }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const offset = index; const char = source[index]
    if (char === " " || char === "\t" || char === "\r") { index++; continue }
    if (char === "\n") { tokens.push({ kind: "newline", value: "\n", offset }); index++; continue }
    if (source.startsWith("//", index)) { while (index < source.length && source[index] !== "\n") index++; continue }
    if (char === '"') { index++; let value = ""; while (index < source.length && source[index] !== '"') { if (source[index] === "\\") throw new UnifiedSyntaxError(`String escapes are not implemented at offset ${index}.`); value += source[index++] } if (source[index] !== '"') throw new UnifiedSyntaxError(`Unterminated string at offset ${offset}.`); index++; tokens.push({ kind: "string", value, offset }); continue }
    const number = source.slice(index).match(/^-?(?:\d+\.?\d*|\.\d+)/)
    if (number) { index += number[0].length; tokens.push({ kind: "word", value: number[0], offset }); continue }
    const word = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_-]*/)
    if (word) { index += word[0].length; tokens.push({ kind: "word", value: word[0], offset }); continue }
    const operator = source.slice(index).match(/^(==|!=|<=|>=)/)
    if (operator) { tokens.push({ kind: "symbol", value: operator[0], offset }); index += operator[0].length; continue }
    if ("{}[](),.:=;+-*/<>".includes(char)) { tokens.push({ kind: "symbol", value: char, offset }); index++; continue }
    throw new UnifiedSyntaxError(`Unexpected '${char}' at offset ${offset}.`)
  }
  tokens.push({ kind: "eof", value: "", offset: source.length })
  return tokens
}
