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
  return new UnifiedParser(tokenize(source)).module()
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
const reserved = new Set("let fn if else for in while do until return break module import export struct set true false null".split(" "))
class UnifiedParser {
  private index = 0
  private enclosed = false
  private bareHeader = false
  private nodeBody = false
  private functions = 0
  private loops = 0
  constructor(private readonly tokens: Token[]) {}
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
  private primary(): UnifiedExpression {
    if (this.consume("if")) {
      const condition = this.header(() => this.expression()); const thenBody = this.block()
      const checkpoint = this.index; this.inline()
      const elseBody = this.consume("else") ? this.block() : (this.index = checkpoint, [])
      return { kind: "if", condition, thenBody, elseBody }
    }
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
    let cursor = this.index
    if (this.at("(")) {
      let depth = 0
      while (cursor < this.tokens.length) {
        const current = this.tokens[cursor++]
        if (current.kind !== "symbol") continue
        if (current.value === "(") depth++
        if (current.value === ")" && --depth === 0) break
      }
    }
    if (!this.bareHeader && this.tokens[cursor]?.kind === "symbol" && this.tokens[cursor].value === "{") {
      const attributes = this.consume("(") ? this.list(")", () => {
        const key = this.word("Expected an attribute name", true); this.trivia(); this.expect("=")
        return { key, value: this.expression() }
      }) : []
      return { kind: "node", tag: name, classes: [...new Set(classes)], attributes, body: this.block(true) }
    }
    this.index = checkpoint
    return { kind: "reference", name }
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
  private peek(lookahead = 0): Token { return this.tokens[this.index + lookahead] ?? this.tokens.at(-1)! }
  private next(): Token { return this.tokens[this.index++] }
  private fail(message: string): never { throw new UnifiedSyntaxError(`${message} at offset ${this.peek().offset}.`) }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const offset = index; const char = source[index]
    if (char === " " || char === "\t" || char === "\r") { index++; continue }
    if (char === "\n") { tokens.push({ kind: "newline", value: "\n", offset }); index++; continue }
    if (source.startsWith("//", index)) { while (index < source.length && source[index] !== "\n") index++; continue }
    if (char === '"') {
      index++; let value = ""
      while (index < source.length && source[index] !== '"') {
        if ("\\\r\n".includes(source[index])) throw new UnifiedSyntaxError(`String escapes and multiline strings are not implemented at offset ${index}.`)
        value += source[index++]
      }
      if (source[index] !== '"') throw new UnifiedSyntaxError(`Unterminated string at offset ${offset}.`)
      index++; tokens.push({ kind: "string", value, offset }); continue
    }
    const number = source.slice(index).match(/^(?:\d+\.?\d*|\.\d+)/)
    if (number) { index += number[0].length; tokens.push({ kind: "number", value: number[0], offset }); continue }
    const word = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_-]*/)
    if (word) { index += word[0].length; tokens.push({ kind: "word", value: word[0], offset }); continue }
    const operator = source.slice(index).match(/^(\.\.\.|\|\||&&|==|!=|<=|>=)/)
    if (operator) { tokens.push({ kind: "symbol", value: operator[0], offset }); index += operator[0].length; continue }
    if ("{}[](),.:=;!+-*/<>".includes(char)) { tokens.push({ kind: "symbol", value: char, offset }); index++; continue }
    throw new UnifiedSyntaxError(`Unexpected '${char}' at offset ${offset}.`)
  }
  tokens.push({ kind: "eof", value: "", offset: source.length })
  return tokens
}
