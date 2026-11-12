import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildLiterate,
  buildMatraComponent,
  buildMatraProgram,
  LiterateError,
  runLiterate,
} from "@matra/core/experimental/literate"

const page = source =>
  buildLiterate(`---\nmatra:\n  entry: main.matra\n---\n\`\`\`main.matra\n${source}\n\`\`\`\n`, {
    document: "pages/index.matra.md",
  })
const component = (source, document = "components/Card.matra") =>
  buildMatraComponent(source, { document })
const card = "fn Card(props, children) { article { h2 { props.title }; ...children } }"

test("raw Matra programs compile without Markdown and use globals and component bundles", async () => {
  const bundle = await buildMatraProgram('Card({ title: page.title }, [p { "Body" }])', {
    document: "pages/raw.matra",
  })
  assert.equal(bundle.entry.source, 'Card({ title: page.title }, [p { "Body" }])')
  assert.equal(bundle.entry.line, 1)
  assert.deepEqual(bundle.values, [])
  assert.deepEqual(
    await runLiterate(JSON.parse(JSON.stringify(bundle)), {
      globals: { page: { title: "From JS" } },
      components: [await component(card)],
    }),
    {
      tag: "article",
      props: {},
      children: [
        { tag: "h2", props: {}, children: ["From JS"] },
        { tag: "p", props: {}, children: ["Body"] },
      ],
    },
  )
  assert.equal((await buildMatraProgram("p {}")).entry.document, "program.matra")
  await assert.rejects(buildMatraProgram("p {\n", { document: "pages/raw.matra" }), error => {
    assert.equal(error.code, "MATRA_COMPILE")
    assert.match(error.message, /pages\/raw\.matra:2:1/)
    return true
  })
  for (const [source, options] of [
    [null, {}],
    ["p {}", null],
    ["p {}", { document: "" }],
    ["p {}", { values: [] }],
  ]) {
    await assert.rejects(buildMatraProgram(source, options), { code: "INVALID_OPTIONS" })
  }
})

test("component bundles survive JSON round trips and compose with props and children", async () => {
  const components = await Promise.all([
    component(card),
    component(
      "fn Panel(props, children) { section { Card({ title: props.title }, children) } }",
      "components/Panel.matra",
    ),
  ])
  const bundle = await page(
    'main { Panel({ title: page.title }, [p { "Body" }, a(href="/guide/") { "Guide" }]); Card({ title: "Empty" }, []) }',
  )
  const options = {
    components: JSON.parse(JSON.stringify(components)),
    globals: { page: { title: "<Title>" } },
  }
  const expected = {
    tag: "main",
    props: {},
    children: [
      {
        tag: "section",
        props: {},
        children: [
          {
            tag: "article",
            props: {},
            children: [
              { tag: "h2", props: {}, children: ["<Title>"] },
              { tag: "p", props: {}, children: ["Body"] },
              { tag: "a", props: { href: "/guide/" }, children: ["Guide"] },
            ],
          },
        ],
      },
      { tag: "article", props: {}, children: [{ tag: "h2", props: {}, children: ["Empty"] }] },
    ],
  }
  assert.deepEqual(await runLiterate(bundle, options), expected)
  assert.deepEqual(await runLiterate(bundle, options), expected)
  assert.deepEqual(options.globals, { page: { title: "<Title>" } })
})

test("components support ordinary helper functions and fresh local variables", async () => {
  const counter = await component(
    `fn Counter(data, nodes) {
  let count = 0
  fn next() { count = count + 1; count }
  p { next(); next(); data.label; ...nodes }
}`,
    "components/Counter.matra",
  )
  const bundle = await page('main { Counter({ label: "A" }, []); Counter({ label: "B" }, []) }')
  assert.deepEqual(await runLiterate(bundle, { components: [counter] }), {
    tag: "main",
    props: {},
    children: [
      { tag: "p", props: {}, children: [1, 2, "A"] },
      { tag: "p", props: {}, children: [1, 2, "B"] },
    ],
  })
})

test("component definitions require one top-level function with two parameters", async () => {
  for (const source of [
    "",
    "p {}",
    "fn Card(props) { p {} }",
    "fn Card(props, children, extra) { p {} }",
    "fn Card(props, children) { p {} }\nCard",
    "let title = 1\nfn Card(props, children) { p {} }",
    "fn Card(props, children) { p {} }\nfn Other(props, children) { p {} }",
  ]) {
    await assert.rejects(component(source), { code: "COMPONENT_DEFINITION" })
  }
  await assert.rejects(component("fn Card(props, children) {\n  p {\n}"), error => {
    assert.equal(error.code, "MATRA_COMPILE")
    assert.match(error.message, /components\/Card\.matra/)
    return true
  })
  for (const [source, options] of [
    [null, {}],
    [card, null],
    [card, { document: "" }],
    [card, { unknown: true }],
  ]) {
    await assert.rejects(buildMatraComponent(source, options), { code: "INVALID_OPTIONS" })
  }
})

test("component calls validate arity, props, children, and the node result", async () => {
  const definition = await component(card)
  for (const call of [
    "Card()",
    "Card({ title: 1 })",
    "Card({ title: 1 }, [], 3)",
    "Card(null, [])",
    "Card([], [])",
    "Card(1, [])",
    "Card({}, null)",
    "Card({}, {})",
  ]) {
    await assert.rejects(runLiterate(await page(call), { components: [definition] }), error => {
      assert.equal(error.code, "COMPONENT_ARGUMENTS")
      assert.equal(error.document, "components/Card.matra")
      assert.match(error.message, /pages\/index\.matra\.md/)
      return true
    })
  }
  for (const result of ['"text"', "[]", "null", "1", '{ tag: "p", props: null, children: [] }']) {
    const invalid = await component(`fn Card(props, children) { ${result} }`)
    await assert.rejects(runLiterate(await page("Card({}, [])"), { components: [invalid] }), {
      code: "COMPONENT_RESULT",
    })
  }
  const bundle = await page("fn helper() { 1 }\nCard({ callback: helper }, [])")
  await assert.rejects(runLiterate(bundle, { components: [definition] }), {
    code: "COMPONENT_VALUE",
  })
})

test("component names cannot collide with components, globals, value modules, or local declarations", async () => {
  const definition = await component(card)
  const bundle = await page('Card({ title: "Title" }, [])')
  const lower = await component("fn card(props, children) { p {} }", "components/other.matra")
  await assert.rejects(runLiterate(bundle, { components: [definition, lower] }), {
    code: "COMPONENT_COLLISION",
  })
  await assert.rejects(runLiterate(bundle, { components: [definition], globals: { Card: {} } }), {
    code: "COMPONENT_COLLISION",
  })
  const values = await buildLiterate(`---
matra:
  entry: main.matra
  values: [Card.js.part]
---
\`\`\`main.matra
p {}
\`\`\`
\`\`\`Card.js.part
({})
\`\`\`
`)
  await assert.rejects(runLiterate(values, { components: [definition] }), {
    code: "COMPONENT_COLLISION",
  })
  await assert.rejects(
    runLiterate(await page("fn Card(props, children) { p {} }\np {}"), {
      components: [definition],
    }),
    /Duplicate binding: Card/,
  )
})

test("components cannot implicitly access caller globals, value modules, or locals", async () => {
  for (const name of ["page", "site", "secret"]) {
    const definition = await component(`fn Card(props, children) { p { ${name}.title } }`)
    await assert.rejects(
      runLiterate(await page('let secret = { title: "local" }\nCard({}, [])'), {
        components: [definition],
        globals: { page: { title: "page" }, site: { title: "site" } },
      }),
      error => {
        assert.equal(error.code, "COMPONENT_RUNTIME")
        assert.equal(error.document, "components/Card.matra")
        assert.match(error.message, new RegExp(`Unknown name: ${name}`))
        assert.match(error.message, /called from pages\/index\.matra\.md/)
        return true
      },
    )
  }
  await assert.rejects(runLiterate(await page("p {}"), { globals: { Card: () => {} } }), {
    code: "UNSUPPORTED_VALUE",
  })
})

test("component cycles and nested failures preserve the originating document and call chain", async () => {
  const recursive = await component("fn Card(props, children) { Card(props, children) }")
  await assert.rejects(
    runLiterate(await page("Card({}, [])"), { components: [recursive] }),
    error => {
      assert.equal(error.code, "COMPONENT_CYCLE")
      assert.match(error.message, /Card -> Card/)
      return true
    },
  )
  const panel = await component(
    "fn Panel(props, children) { Card(props, children) }",
    "components/Panel.matra",
  )
  const indirect = await component("fn Card(props, children) { Panel(props, children) }")
  await assert.rejects(
    runLiterate(await page("Card({}, [])"), { components: [indirect, panel] }),
    error => {
      assert.equal(error.code, "COMPONENT_CYCLE")
      assert.match(error.message, /Card -> Panel -> Card/)
      return true
    },
  )
  const invalid = await component("fn Card(props, children) { p { props.missing } }")
  await assert.rejects(
    runLiterate(await page("Panel({}, [])"), { components: [invalid, panel] }),
    error => {
      assert.equal(error.document, "components/Card.matra")
      assert.match(error.message, /Panel -> Card/)
      assert.match(error.message, /Unknown member: missing/)
      return true
    },
  )
})

test("invalid component bundles and options fail explicitly", async () => {
  const definition = await component(card)
  const bundle = await page("p {}")
  for (const invalid of [
    null,
    { ...definition, format: "unknown" },
    { ...definition, abi: "unknown" },
    { ...definition, name: "Other" },
    { ...definition, wasm: "not base64" },
    { ...definition, wasm: Buffer.from("invalid").toString("base64") },
    { ...definition, wasm: "AGFzbQEAAAA=" },
  ]) {
    await assert.rejects(
      runLiterate(bundle, { components: [invalid] }),
      error => error instanceof LiterateError && error.code === "INVALID_BUNDLE",
    )
  }
  await assert.rejects(runLiterate(bundle, { components: {} }), { code: "INVALID_OPTIONS" })
})
