/** 統一文法の parser と、静的取得・明示的実行。 */
export type UnifiedScalar = string | number | boolean | null
export type UnifiedExpression =
  | { kind: "literal", value: UnifiedScalar }
  | { kind: "array", items: UnifiedExpression[] }
  | { kind: "object", entries: { key: string, value: UnifiedExpression }[] }
  | { kind: "reference", name: string }
  | { kind: "member", object: UnifiedExpression, name: string }
  | { kind: "call", callee: UnifiedExpression, arguments: UnifiedExpression[] }
  | { kind: "binary", operator: string, left: UnifiedExpression, right: UnifiedExpression }
  | { kind: "unary", operator: string, operand: UnifiedExpression }
  | { kind: "node", tag: string, classes: string[], attributes: { key: string, value: UnifiedExpression }[], body: UnifiedStatement[] }
  | { kind: "if", condition: UnifiedExpression, thenBody: UnifiedStatement[], elseBody: UnifiedStatement[] }
  | { kind: "for", name: string, iterable: UnifiedExpression, body: UnifiedStatement[] }
  | { kind: "while", condition: UnifiedExpression, body: UnifiedStatement[] }
  | { kind: "do", condition: UnifiedExpression, body: UnifiedStatement[] }

export type UnifiedStatement =
  | { kind: "expression", expression: UnifiedExpression }
  | { kind: "spread", expression: UnifiedExpression }
  | { kind: "let", name: string, value: UnifiedExpression }
  | { kind: "assign", name: string, value: UnifiedExpression }
  | { kind: "return", value: UnifiedExpression }
  | { kind: "break" }
  | { kind: "fn", name: string, parameters: string[], body: UnifiedStatement[] }

export interface UnifiedModule { kind: "module", statements: UnifiedStatement[] }
export interface StaticNode { tag: string, props: Record<string, StaticValue>, children: StaticValue[] }
export type StaticValue = UnifiedScalar | StaticValue[] | { [key: string]: StaticValue } | StaticNode
export interface StaticToASTNode { tag: string, props: Record<string, StaticValue>, children: (StaticToASTNode | StaticValue)[] }
export class UnifiedSyntaxError extends SyntaxError {}
export class EvaluationRequiredError extends Error {
  constructor(message: string) { super(message); this.name = "EvaluationRequiredError" }
}

class Scope {
  private readonly bindings = new Map<string, any>()
  constructor(private readonly parent?: Scope) {}
  declare(name: string, value: any): void {
    if (this.bindings.has(name)) throw new SyntaxError(`Duplicate binding: ${name}`)
    this.bindings.set(name, value)
  }
  get(name: string): any {
    if (this.bindings.has(name)) return this.bindings.get(name)
    if (this.parent) return this.parent.get(name)
    throw new ReferenceError(`Unknown name: ${name}`)
  }
  assign(name: string, value: any): void {
    if (this.bindings.has(name)) this.bindings.set(name, value)
    else if (this.parent) this.parent.assign(name, value)
    else throw new ReferenceError(`Unknown name: ${name}`)
  }
}
class Returned { constructor(readonly value: any) {} }
class Broken {}

export function parseUnified(source: string): UnifiedModule {
  return new UnifiedParser(source).module()
}
export function evaluateStatic(module: UnifiedModule): StaticValue | undefined {
  return new Evaluator(true).run(module.statements, new Scope())
}
export function evaluateUnified(module: UnifiedModule): StaticValue | undefined {
  return new Evaluator(false).run(module.statements, new Scope())
}

class Evaluator {
  constructor(private readonly staticOnly: boolean) {}
  private dynamic(kind: string): void {
    if (this.staticOnly) throw new EvaluationRequiredError(`Static evaluation does not execute ${kind}.`)
  }
  run(statements: UnifiedStatement[], scope: Scope, children?: any[]): any {
    let output: any = null
    for (const statement of statements) {
      output = null
      switch (statement.kind) {
        case "expression":
          output = this.expression(statement.expression, scope)
          if (children) children.push(output)
          break
        case "spread": {
          if (!children) throw new SyntaxError("Spread is only allowed in a node body")
          const items = this.expression(statement.expression, scope)
          if (!Array.isArray(items)) throw new TypeError("Spread requires an array")
          children.push(...items)
          break
        }
        case "let": scope.declare(statement.name, this.expression(statement.value, scope)); break
        case "assign": this.dynamic("assignment"); scope.assign(statement.name, this.expression(statement.value, scope)); break
        case "return": this.dynamic("return"); throw new Returned(this.expression(statement.value, scope))
        case "break": this.dynamic("break"); throw new Broken()
        case "fn": {
          this.dynamic("function declaration")
          scope.declare(statement.name, (...args: any[]) => {
            const local = new Scope(scope)
            statement.parameters.forEach((name, index) => local.declare(name, args[index] ?? null))
            try { return this.run(statement.body, local) }
            catch (flow) { if (flow instanceof Returned) return flow.value; throw flow }
          })
          break
        }
      }
    }
    return output
  }
  private expression(expr: UnifiedExpression, scope: Scope): any {
    switch (expr.kind) {
      case "literal": return expr.value
      case "reference":
        try { return scope.get(expr.name) }
        catch (error) { if (this.staticOnly) throw new EvaluationRequiredError(`Static evaluation requires '${expr.name}'.`); throw error }
      case "array": return expr.items.map(value => this.expression(value, scope))
      case "object": return Object.fromEntries(expr.entries.map(({ key, value }) => [key, this.expression(value, scope)]))
      case "node": {
        const props = Object.fromEntries(expr.attributes.map(({ key, value }) => [key, this.expression(value, scope)]))
        if (expr.classes.length) props.class = expr.classes.join(" ")
        const children: any[] = []
        this.run(expr.body, new Scope(scope), children)
        return { tag: expr.tag, props, children }
      }
      case "member": {
        this.dynamic("member access")
        const object = this.expression(expr.object, scope)
        if (object == null || !Object.hasOwn(Object(object), expr.name)) throw new ReferenceError(`Unknown member: ${expr.name}`)
        return object[expr.name]
      }
      case "call": {
        this.dynamic("call")
        const callee = this.expression(expr.callee, scope)
        if (typeof callee !== "function") throw new TypeError("Call target is not a function")
        return callee(...expr.arguments.map(arg => this.expression(arg, scope)))
      }
      case "unary": {
        this.dynamic("unary expression")
        const operand = this.expression(expr.operand, scope)
        return expr.operator === "!" ? !operand : -Number(operand)
      }
      case "binary": {
        this.dynamic("binary expression")
        const left = this.expression(expr.left, scope)
        if (expr.operator === "&&") return left && this.expression(expr.right, scope)
        if (expr.operator === "||") return left || this.expression(expr.right, scope)
        const right = this.expression(expr.right, scope)
        switch (expr.operator) {
          case "+": return left + right
          case "-": return left - right
          case "*": return left * right
          case "/": return left / right
          case "==": return left === right
          case "!=": return left !== right
          case "<": return left < right
          case "<=": return left <= right
          case ">": return left > right
          case ">=": return left >= right
          default: throw new TypeError(`Unknown operator: ${expr.operator}`)
        }
      }
      case "if":
        this.dynamic("if")
        return this.run(this.expression(expr.condition, scope) ? expr.thenBody : expr.elseBody, new Scope(scope))
      case "for": {
        this.dynamic("for")
        const values = this.expression(expr.iterable, scope)
        if (!Array.isArray(values)) throw new TypeError("Expected an array")
        const results = []
        for (const value of values) {
          const local = new Scope(scope); local.declare(expr.name, value)
          try { results.push(this.run(expr.body, local)) }
          catch (flow) { if (flow instanceof Broken) break; throw flow }
        }
        return results
      }
      case "while":
      case "do": {
        this.dynamic(expr.kind)
        let first = true
        while (expr.kind === "do" && first || (expr.kind === "do" ? !this.expression(expr.condition, scope) : this.expression(expr.condition, scope))) {
          first = false
          try { this.run(expr.body, new Scope(scope)) }
          catch (flow) { if (flow instanceof Broken) break; throw flow }
        }
        return null
      }
    }
  }
}

export function staticValueToAST(value: StaticValue): StaticToASTNode {
  if (!isStaticNode(value)) throw new TypeError("A document renderer requires a static Matra node output.")
  return { tag: value.tag, props: value.props, children: value.children.map(child => isStaticNode(child) ? staticValueToAST(child) : child) }
}
function isStaticNode(value: StaticValue): value is StaticNode {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    typeof (value as StaticNode).tag === "string" && typeof (value as StaticNode).props === "object" && Array.isArray((value as StaticNode).children)
}

type Token = { value: string, offset: number, kind: "word" | "number" | "string" | "symbol" | "newline" | "eof" }
const reserved = new Set("let fn if else else_if for in while do until return break module import export struct set true false null".split(" "))
class UnifiedParser {
  private readonly tokens: Token[] = []
  private lexer: Generator<Token>
  private index = 0
  private enclosed = false
  private bareHeader = false
  private nodeBody = false
  private functions = 0
  private loops = 0
  constructor(private readonly source: string) { this.lexer = tokenize(source) }
  module(): UnifiedModule { const statements = this.statements("eof"); this.expect("eof"); return { kind: "module", statements } }
  private statements(end: string): UnifiedStatement[] {
    const result: UnifiedStatement[] = []; this.separators()
    while (!this.at(end)) {
      if (this.at("eof")) this.fail(`Expected '${end}'`)
      result.push(this.statement())
      if (!this.at(end) && !this.separators()) this.fail("Expected a newline or ';' between expressions")
    }
    return result
  }
  private statement(): UnifiedStatement {
    if (this.consume("let")) {
      const parenthesized = this.consume("(")
      const binding = (): UnifiedStatement => {
        const name = this.word("Expected a variable name"); this.trivia(); this.expect("=")
        return { kind: "let", name, value: this.expression() }
      }
      const result = parenthesized ? this.nested(binding) : binding()
      if (parenthesized) this.expect(")")
      return result
    }
    if (this.consume("return")) { if (!this.functions) this.fail("return outside a function"); return { kind: "return", value: this.expression() } }
    if (this.consume("break")) { if (!this.loops) this.fail("break outside a loop"); return { kind: "break" } }
    if (this.consume("...")) { if (!this.nodeBody) this.fail("Spread is only allowed in a node body"); return { kind: "spread", expression: this.expression() } }
    if (this.consume("fn")) {
      const name = this.word("Expected a function name"); this.expect("(")
      const parameters = this.list(")", () => this.word("Expected a parameter name"))
      if (new Set(parameters).size !== parameters.length) this.fail("Duplicate parameter")
      const loops = this.loops; this.loops = 0; this.functions++
      const body = this.block(); this.functions--; this.loops = loops
      return { kind: "fn", name, parameters, body }
    }
    if (this.peek().kind === "word" && this.peek(1).value === "=") {
      const name = this.word("Expected a variable name"); this.expect("=")
      return { kind: "assign", name, value: this.expression() }
    }
    return { kind: "expression", expression: this.expression() }
  }
  private block(node = false): UnifiedStatement[] {
    this.expect("{")
    const saved = [this.enclosed, this.bareHeader, this.nodeBody]
    this.enclosed = false; this.bareHeader = false; this.nodeBody = node
    const body = this.statements("}"); this.expect("}")
    ;[this.enclosed, this.bareHeader, this.nodeBody] = saved
    return body
  }
  private nested<T>(parse: () => T, trailing = true): T {
    const saved = [this.enclosed, this.bareHeader]
    this.enclosed = true; this.bareHeader = false; this.inline()
    const value = parse(); if (trailing) this.inline()
    ;[this.enclosed, this.bareHeader] = saved
    return value
  }
  private header<T>(parse: () => T): T {
    if (this.consume("(")) { const value = this.nested(parse); this.expect(")"); return value }
    const saved = [this.enclosed, this.bareHeader]
    this.enclosed = false; this.bareHeader = true
    const value = parse()
    ;[this.enclosed, this.bareHeader] = saved
    return value
  }
  private expression(minimum = 1): UnifiedExpression {
    this.trivia()
    let value = this.unary()
    const precedence: Record<string, number> = { "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6 }
    while (true) {
      this.trivia()
      const priority = this.peek().kind === "symbol" ? precedence[this.peek().value] ?? 0 : 0
      if (priority < minimum) break
      const operator = this.next().value
      value = { kind: "binary", operator, left: value, right: this.expression(priority + 1) }
    }
    return value
  }
  private unary(): UnifiedExpression {
    this.trivia()
    if (this.at("!") || this.at("-")) { const operator = this.next().value; return { kind: "unary", operator, operand: this.unary() } }
    let value = this.primary()
    while (true) {
      this.trivia()
      if (this.consume(".")) value = { kind: "member", object: value, name: this.word("Expected a member name", true) }
      else if (this.consume("(")) value = { kind: "call", callee: value, arguments: this.list(")", () => this.expression()) }
      else break
    }
    return value
  }
  private ifExpression(): UnifiedExpression {
    const condition = this.header(() => this.expression()); const thenBody = this.block()
    const checkpoint = this.index; this.inline()
    const elseBody: UnifiedStatement[] = this.consume("else_if")
      ? [{ kind: "expression", expression: this.ifExpression() }]
      : this.consume("else") ? this.block() : (this.index = checkpoint, [])
    return { kind: "if", condition, thenBody, elseBody }
  }
  private primary(): UnifiedExpression {
    if (this.at("<")) {
      const markup = new MarkupParser(this.source, this.peek().offset)
      const value = markup.node()
      this.tokens.length = this.index
      this.lexer = tokenize(this.source, markup.offset)
      return value
    }
    if (this.consume("if")) return this.ifExpression()
    if (this.consume("for")) {
      const { name, iterable } = this.header(() => {
        const name = this.word("Expected a loop variable"); this.trivia(); this.expect("in")
        return { name, iterable: this.expression() }
      })
      this.loops++; const body = this.block(); this.loops--
      return { kind: "for", name, iterable, body }
    }
    if (this.consume("while")) {
      const condition = this.header(() => this.expression())
      this.loops++; const body = this.block(); this.loops--
      return { kind: "while", condition, body }
    }
    if (this.consume("do")) {
      this.loops++; const body = this.block(); this.loops--
      this.inline(); this.expect("until"); this.expect("(")
      const condition = this.nested(() => this.expression()); this.expect(")")
      return { kind: "do", condition, body }
    }
    const token = this.peek()
    if (token.kind === "string") { this.next(); return { kind: "literal", value: token.value } }
    if (token.kind === "number") { this.next(); const value = Number(token.value); if (!Number.isFinite(value)) this.fail("Number is out of range"); return { kind: "literal", value } }
    for (const [name, value] of [["true", true], ["false", false], ["null", null]] as const) { if (this.consume(name)) return { kind: "literal", value } }
    if (this.consume("(")) { const value = this.nested(() => this.expression()); this.expect(")"); return value }
    if (this.consume("[")) return { kind: "array", items: this.list("]", () => this.expression()) }
    if (this.consume("{")) return { kind: "object", entries: this.list("}", () => {
      const key = this.peek().kind === "string" ? this.next().value : this.word("Expected an object key", true)
      this.trivia(); this.expect(":"); return { key, value: this.expression() }
    }) }
    const name = this.word("Expected an expression")
    const checkpoint = this.index; const classes: string[] = []
    while (this.consume(".")) classes.push(this.word("Expected a class name", true))
    if (this.startsNode()) {
      const attributes = this.consume("(") ? this.list(")", () => {
        const key = this.word("Expected an attribute name", true); this.trivia(); this.expect("=")
        return { key, value: this.expression() }
      }) : []
      return { kind: "node", tag: name, classes: [...new Set(classes)], attributes, body: this.block(true) }
    }
    this.index = checkpoint
    return { kind: "reference", name }
  }
  private startsNode(): boolean {
    if (this.bareHeader) return false
    if (this.at("{")) return true
    if (!this.at("(")) return false

    let cursor = this.index + 1
    while (this.token(cursor).kind === "newline") cursor++
    const first = this.token(cursor)
    if (first.kind === "symbol" && first.value === ")") {
      const following = this.token(cursor + 1)
      return following.kind === "symbol" && following.value === "{"
    }
    if (first.kind !== "word") return false

    cursor++
    while (this.token(cursor).kind === "newline") cursor++
    const following = this.token(cursor)
    return following.kind === "symbol" && following.value === "="
  }
  private list<T>(end: string, item: () => T): T[] {
    return this.nested(() => {
      const values: T[] = []
      if (this.consume(end)) return values
      while (true) {
        this.inline(); values.push(item()); this.inline()
        if (this.consume(end)) return values
        this.expect(",")
      }
    }, false)
  }
  private trivia(): void { if (this.enclosed) this.inline() }
  private separators(): boolean { const start = this.index; while (this.at("newline") || this.at(";")) this.next(); return this.index !== start }
  private inline(): void { while (this.at("newline")) this.next() }
  private word(message: string, property = false): string { if (this.peek().kind !== "word" || !property && reserved.has(this.peek().value)) this.fail(message); return this.next().value }
  private consume(value: string): boolean { if (!this.at(value)) return false; this.next(); return true }
  private expect(value: string): void { if (!this.consume(value)) this.fail(`Expected '${value}'`) }
  private at(value: string): boolean { const token = this.peek(); return value === "eof" ? token.kind === "eof" : value === "newline" ? token.kind === "newline" : token.kind !== "string" && token.value === value }
  private token(index: number): Token {
    while (index >= this.tokens.length) {
      const token = this.lexer.next().value
      if (!token) return this.tokens.at(-1)!
      this.tokens.push(token)
    }
    return this.tokens[index]
  }
  private peek(lookahead = 0): Token { return this.token(this.index + lookahead) }
  private next(): Token { const token = this.peek(); this.index++; return token }
  private fail(message: string): never { throw new UnifiedSyntaxError(`${message} at offset ${this.peek().offset}.`) }
}

function* tokenize(source: string, index = 0): Generator<Token> {
  while (index < source.length) {
    const offset = index; const char = source[index]
    if (char === " " || char === "\t" || char === "\r") { index++; continue }
    if (char === "\n") { index++; yield { kind: "newline", value: "\n", offset }; continue }
    if (source.startsWith("//", index)) { while (index < source.length && source[index] !== "\n") index++; continue }
    if (char === '"') {
      index++; let value = ""
      while (index < source.length && source[index] !== '"') {
        if ("\\\r\n".includes(source[index])) throw new UnifiedSyntaxError(`String escapes and multiline strings are not implemented at offset ${index}.`)
        value += source[index++]
      }
      if (source[index] !== '"') throw new UnifiedSyntaxError(`Unterminated string at offset ${offset}.`)
      index++; yield { kind: "string", value, offset }; continue
    }
    const number = source.slice(index).match(/^(?:\d+\.?\d*|\.\d+)/)
    if (number) { index += number[0].length; yield { kind: "number", value: number[0], offset }; continue }
    const word = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_-]*/)
    if (word) { index += word[0].length; yield { kind: "word", value: word[0], offset }; continue }
    const operator = source.slice(index).match(/^(\.\.\.|\|\||&&|==|!=|<=|>=)/)
    if (operator) { index += operator[0].length; yield { kind: "symbol", value: operator[0], offset }; continue }
    if ("{}[](),.:=;!+-*/<>".includes(char)) { index++; yield { kind: "symbol", value: char, offset }; continue }
    throw new UnifiedSyntaxError(`Unexpected '${char}' at offset ${offset}.`)
  }
  yield { kind: "eof", value: "", offset: source.length }
}

class MarkupParser {
  constructor(private readonly source: string, public offset: number) {}
  node(): UnifiedExpression {
    this.expect("<")
    const tag = this.name("tag")
    const classes: string[] = []
    while (this.take(".")) {
      const name = this.name("class")
      if (!classes.includes(name)) classes.push(name)
    }
    const attributes: { key: string, value: UnifiedExpression }[] = []
    const keys = new Set<string>()
    while (true) {
      const separated = this.whitespace()
      if (this.take("/>")) return { kind: "node", tag, classes, attributes, body: [] }
      if (this.take(">")) break
      if (!separated) this.fail("Expected whitespace or tag delimiter")
      const start = this.offset
      const key = this.name()
      if (keys.has(key)) this.fail("Duplicate markup attribute", start)
      keys.add(key)
      this.whitespace(); this.expect("="); this.whitespace()
      const quote = this.source[this.offset]
      if (quote !== '"' && quote !== "'") this.fail("Expected a quoted attribute")
      this.offset++
      const value = this.text(quote)
      this.expect(quote)
      attributes.push({ key, value: { kind: "literal", value } })
    }
    const body: UnifiedStatement[] = []
    while (!this.take("</")) {
      if (this.offset === this.source.length) this.fail(`Expected closing tag '${tag}'`)
      const expression = this.source[this.offset] === "<" ? this.node() : { kind: "literal" as const, value: this.text("<") }
      body.push({ kind: "expression", expression })
    }
    const start = this.offset
    if (this.name("tag") !== tag) this.fail(`Expected closing tag '${tag}'`, start)
    this.whitespace(); this.expect(">")
    return { kind: "node", tag, classes, attributes, body }
  }
  private text(end: string): string {
    let value = ""
    while (this.offset < this.source.length && this.source[this.offset] !== end) {
      const start = this.offset
      if (this.source[start] === "&") {
        const reference = this.source.slice(start).match(/^&(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/)
        if (!reference) this.fail("Invalid character reference")
        const name = reference[0].slice(1, -1)
        const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }
        if (name.startsWith("#")) {
          const code = name[1] === "x" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1))
          this.character(code)
          value += String.fromCodePoint(code)
        } else value += entities[name]
        this.offset += reference[0].length
      } else {
        if (end !== "<" && this.source[start] === "<") this.fail("Unexpected '<' in attribute")
        if (end === "<" && this.source.startsWith("]]>", start)) this.fail("Unexpected ']]>' in text")
        const code = this.source.codePointAt(start)!
        this.character(code)
        const character = String.fromCodePoint(code)
        value += character
        this.offset += character.length
      }
    }
    return value
  }
  private character(code: number): void {
    if (!(code === 9 || code === 10 || code === 13 || code >= 0x20 && code <= 0xd7ff ||
      code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff)) this.fail("Invalid XML character")
  }
  private name(kind: "tag" | "class" | "attribute" = "attribute"): string {
    const pattern = kind === "tag" ? /^[A-Za-z_:][A-Za-z0-9_:-]*/ :
      kind === "class" ? /^[A-Za-z_][A-Za-z0-9_-]*/ : /^[A-Za-z_:][A-Za-z0-9_.:-]*/
    const name = this.source.slice(this.offset).match(pattern)
    if (!name) this.fail("Expected a markup name")
    this.offset += name[0].length
    return name[0]
  }
  private whitespace(): boolean {
    const start = this.offset
    while (/[ \t\r\n]/.test(this.source[this.offset] ?? "") && this.offset < this.source.length) this.offset++
    return this.offset !== start
  }
  private take(value: string): boolean {
    if (!this.source.startsWith(value, this.offset)) return false
    this.offset += value.length
    return true
  }
  private expect(value: string): void { if (!this.take(value)) this.fail(`Expected '${value}'`) }
  private fail(message: string, offset = this.offset): never { throw new UnifiedSyntaxError(`${message} at offset ${offset}.`) }
}
