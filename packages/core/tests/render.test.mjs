import assert from "node:assert/strict"
import test from "node:test"
import { parse, renderWith } from "../dist/index.js"

test("renderWith delegates a normalized AST to a domain renderer", () => {
  const ast = parse('message("hello", tone="warm")')
  const renderer = {
    render(node, options) {
      return `${options.prefix}${node.tag}:${node.props.tone}:${node.children[0]}`
    },
  }

  assert.equal(renderWith(renderer, ast, { prefix: "> " }), "> message:warm:hello")
})
