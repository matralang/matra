import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import * as core from "../dist/index.js"
import {
  EvaluationRequiredError,
  evaluate,
  evaluateStatic,
  ProgramSyntaxError,
  parse,
} from "../dist/index.js"

const conformance = JSON.parse(
  await readFile(new URL("../../../spec/fixtures/grammar.json", import.meta.url), "utf8"),
)

describe("Matra parser", () => {
  it("exports the standard API without legacy grammar aliases", () => {
    assert.equal(typeof core.parse, "function")
    assert.equal(typeof core.evaluate, "function")
    assert.equal(typeof core.evaluateStatic, "function")
    assert.ok(Object.keys(core).every(name => !/unified/i.test(name)))
    assert.throws(() => parse("let value ="), ProgramSyntaxError)
  })
  it("normalizes whitespace-separated node attributes to comma-separated AST", () => {
    const source = 'p(title="Matra" options={tags: ["HTML", "JSON"]}\n child=<hr />) {}'
    const comma = 'p(title="Matra", options={tags: ["HTML", "JSON"]}, child=<hr />) {}'
    assert.deepEqual(parse(source), parse(comma))
    assert.deepEqual(evaluateStatic(parse(source)), evaluateStatic(parse(comma)))
  })

  it("reports missing attribute separators and values at the offending token", () => {
    for (const [source, offset] of [
      ['p(a="x"b="y") {}', 7],
      ["p(a=1 b=) {}", 8],
      ["p(a=1 b=", 8],
    ]) {
      assert.throws(() => parse(source), new RegExp(`at offset ${offset}\\.$`))
    }
  })
  it("normalizes markup class shorthand to existing Matra node syntax", () => {
    const markup = parse('<a.button.primary.button class="other" href="/spec/">Link</a>')
    assert.deepEqual(
      markup,
      parse('a.button.primary.button(class="other", href="/spec/") { "Link" }'),
    )
    assert.deepEqual(evaluateStatic(markup), {
      tag: "a",
      props: { class: "button primary", href: "/spec/" },
      children: ["Link"],
    })
    assert.deepEqual(parse("<hr.divider />"), parse("hr.divider {}"))
  })

  it("normalizes markup to existing node syntax and retrieves it statically", () => {
    const markup = parse('<p title="A &amp; B">Hello <strong>Matra</strong>!</p>')
    assert.deepEqual(markup, parse('p(title="A & B") { "Hello "; strong { "Matra" }; "!" }'))
    assert.deepEqual(evaluateStatic(markup), evaluate(markup))
  })

  it("reports markup failures at the offending source offset", () => {
    for (const { source, offset } of conformance.markupDiagnostics) {
      assert.throws(() => parse(source), new RegExp(`at offset ${offset}\\.$`), source)
    }
  })

  it("keeps multiline Matra attributes distinct from calls", () => {
    assert.deepEqual(evaluateStatic(parse('p(\n title\n = "ok"\n) {}')), {
      tag: "p",
      props: { title: "ok" },
      children: [],
    })

    it("keeps node-header lookahead out of markup content", () => {
      const module = parse(`fn identity(x) { x }
[
    identity(<p>unbalanced ( and // text</p>),
    wrapper(
      content
      = <p>unbalanced ) and "text"</p>
    ) {},
    empty() {},
    if true { <hr /> }
]`)
      assert.deepEqual(evaluate(module), [
        { tag: "p", props: {}, children: ["unbalanced ( and // text"] },
        {
          tag: "wrapper",
          props: { content: { tag: "p", props: {}, children: ['unbalanced ) and "text"'] } },
          children: [],
        },
        { tag: "empty", props: {}, children: [] },
        { tag: "hr", props: {}, children: [] },
      ])
    })

    it("preserves the executable document example after markup refinement", async () => {
      const source = await readFile(
        new URL("../../../crates/matra-seed/examples/document.matra", import.meta.url),
        "utf8",
      )
      assert.deepEqual(evaluate(parse(source)), {
        tag: "article",
        props: { lang: "ja", class: "card" },
        children: [
          { tag: "h1", props: {}, children: ["Matra"] },
          {
            tag: "ul",
            props: {},
            children: ["文書", "関数", "Wasm"].map(value => ({
              tag: "li",
              props: {},
              children: [`${value}!`],
            })),
          },
        ],
      })
    })
  })
  it("uses the standard grammar through the default parser", () => {
    assert.deepEqual(evaluate(parse('p { "Hello" }')), {
      tag: "p",
      props: {},
      children: ["Hello"],
    })
  })

  it("keeps node construction distinct from calls and member access", () => {
    const module = parse('heading("Title")\nheading.title { "Title" }\ninvoice.title')
    assert.equal(module.statements[0].expression.kind, "call")
    assert.deepEqual(module.statements[1].expression, {
      kind: "node",
      tag: "heading",
      classes: ["title"],
      attributes: [],
      body: [{ kind: "expression", expression: { kind: "literal", value: "Title" } }],
    })
    assert.equal(module.statements[2].expression.kind, "member")
  })

  it("parses static data, attributes, and static lets", () => {
    const module = parse(`let title = "Matra"
article.card.card(lang="ja", options={theme: "dark"}) {
  h1 { title }
}`)
    assert.deepEqual(evaluateStatic(module), {
      tag: "article",
      props: { lang: "ja", options: { theme: "dark" }, class: "card" },
      children: [{ tag: "h1", props: {}, children: ["Matra"] }],
    })
  })

  it("does not execute calls or unresolved references during static evaluation", () => {
    assert.throws(() => evaluateStatic(parse("format_price(total)")), EvaluationRequiredError)
  })

  it("requires an explicit separator between body expressions", () => {
    assert.throws(() => parse('p { "one" "two" }'), /newline or ';'/)
  })

  it("parses control and function declarations without syntax fallback", () => {
    const module = parse(
      'fn pick(value) { if (value) { return value } else { return "none" } }\nfor (item in items) { p { item } }',
    )
    assert.equal(module.statements[0].kind, "fn")
    assert.equal(module.statements[1].expression.kind, "for")
  })

  it("evaluates functions, conditions, and loops into document children", () => {
    const module = parse(
      'fn label(value) { return value }\nlet items = ["one", "two"]\nul { ...for (item in items) { if (item) { li { label(item) } } } }',
    )
    assert.deepEqual(evaluate(module), {
      tag: "ul",
      props: {},
      children: [
        { tag: "li", props: {}, children: ["one"] },
        { tag: "li", props: {}, children: ["two"] },
      ],
    })
  })

  it("accepts else after a newline", () => {
    assert.equal(
      evaluate(
        parse(`if (false) {
  "unreachable"
}
else {
  "selected"
}`),
      ),
      "selected",
    )
  })

  it("represents else_if using existing nested if expressions", () => {
    assert.deepEqual(
      parse("if a { 1 } else_if b { 2 } else { 3 }"),
      parse("if a { 1 } else { if b { 2 } else { 3 } }"),
    )
  })

  it("reports missing else_if delimiters at the next token or EOF", () => {
    const prefix = "if false {} else_if (true"
    assert.throws(() => parse(`${prefix} {}`), new RegExp(`at offset ${prefix.length + 1}\\.$`))
    assert.throws(() => parse(`${prefix})`), new RegExp(`at offset ${prefix.length + 1}\\.$`))
  })

  it("evaluates arithmetic and comparison operators by precedence", () => {
    assert.equal(evaluate(parse("1 + 2 * 3 == 7")), true)
    assert.equal(evaluate(parse("5 - 2 == 3")), true)
    assert.equal(evaluate(parse("-2 + 3 == 1")), true)
  })

  it("evaluates logical operators with unary negation", () => {
    assert.equal(evaluate(parse("!(false || false) && true")), true)
  })
})

for (const fixture of conformance.accept) {
  it(`grammar conformance: ${fixture.name}`, () => {
    assert.deepEqual(evaluate(parse(fixture.source)), fixture.value)
  })
}
for (const source of conformance.reject) {
  it(`Matra rejects: ${source}`, () => {
    assert.throws(() => evaluate(parse(source)))
  })
}

it("static retrieval respects scope, explicit spread, and null results", () => {
  assert.deepEqual(evaluateStatic(parse("let x = 1\np { let x = 2; ...[x, null] }")), {
    tag: "p",
    props: {},
    children: [2, null],
  })
  assert.equal(evaluateStatic(parse("1; let x = 2")), null)
  assert.throws(() => evaluateStatic(parse("let x = 1; let x = 2")), /Duplicate binding/)
  for (const source of ["if true { 1 }", "for x in [1] { x }", "let x = 1; x = 2"]) {
    assert.throws(() => evaluateStatic(parse(source)), EvaluationRequiredError)
  }
})
