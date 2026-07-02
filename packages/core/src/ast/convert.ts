import type {
  MatraAST,
  MatraASTChild,
  MatraJSON,
  MatraJSONChild,
  MatraValue,
} from "./types.js"

export function isMatraAST(value: unknown): value is MatraAST {
  return (
    isRecord(value) &&
    typeof value.tag === "string" &&
    isRecord(value.props) &&
    Array.isArray(value.children)
  )
}

export function isMatraJSON(value: unknown): value is MatraJSON {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    typeof value[0] === "string" &&
    isRecord(value[1]) &&
    Array.isArray(value[2])
  )
}

/** Convert the object-shaped AST to compact MatraJSON. */
export function astToMatraJSON(ast: MatraAST): MatraJSON {
  return [
    ast.tag,
    cloneValue(ast.props),
    ast.children.map(childToJSON),
  ]
}

/** Convert compact MatraJSON to the object-shaped AST. */
export function matraJSONToAST(node: MatraJSON): MatraAST {
  const [tag, props, children] = node
  return {
    tag,
    props: cloneValue(props),
    children: children.map(childToAST),
  }
}

function childToJSON(child: MatraASTChild): MatraJSONChild {
  return isMatraAST(child) ? astToMatraJSON(child) : cloneValue(child)
}

function childToAST(child: MatraJSONChild): MatraASTChild {
  return isMatraJSON(child) ? matraJSONToAST(child) : cloneValue(child)
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function cloneValue<T extends MatraValue>(value: T): T {
  if (Array.isArray(value)) return value.map(item => cloneValue(item)) as T
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    ) as T
  }
  return value
}
