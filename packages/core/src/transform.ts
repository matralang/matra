import { isMatraAST } from "./convert.js"
import type { MatraAST, MatraASTChild } from "./types.js"

export interface VisitContext {
  parent: MatraAST | null
  index: number | null
}

export type Visitor = (node: MatraAST, context: VisitContext) => void
export type Transformer = (
  node: MatraAST,
  context: VisitContext,
) => MatraAST | null | undefined

/** Depth-first traversal of AST nodes. Literal children are left untouched. */
export function visit(node: MatraAST, visitor: Visitor): void {
  walk(node, null, null, visitor)
}

function walk(
  node: MatraAST,
  parent: MatraAST | null,
  index: number | null,
  visitor: Visitor,
): void {
  visitor(node, { parent, index })
  node.children.forEach((child, childIndex) => {
    if (isMatraAST(child)) walk(child, node, childIndex, visitor)
  })
}

/** Immutable bottom-up transformation. Returning null removes an AST child. */
export function transform(node: MatraAST, transformer: Transformer): MatraAST | null {
  return transformNode(node, null, null, transformer)
}

function transformNode(
  node: MatraAST,
  parent: MatraAST | null,
  index: number | null,
  transformer: Transformer,
): MatraAST | null {
  const children = node.children
    .map((child, childIndex): MatraASTChild | null =>
      isMatraAST(child)
        ? transformNode(child, node, childIndex, transformer)
        : child,
    )
    .filter((child): child is MatraASTChild => child !== null)
  const next: MatraAST = { tag: node.tag, props: { ...node.props }, children }
  const result = transformer(next, { parent, index })
  return result === undefined ? next : result
}
