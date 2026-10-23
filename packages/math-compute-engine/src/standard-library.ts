import { ComputeEngine } from "@cortex-js/compute-engine"

export interface MathCommandInfo {
  name: string
  kind: "function" | "constant"
  category: string
  signature?: string
  description: string
  properties: string[]
  complexity?: number
  wikidata?: string
}

type RawDefinition = {
  description?: unknown
  signature?: unknown
  isConstant?: unknown
  value?: unknown
  type?: unknown
  associative?: unknown
  commutative?: unknown
  idempotent?: unknown
  complexity?: unknown
  wikidata?: unknown
}

type RawLibrary = {
  name: string
  definitions: unknown
}

const standardMathCommands = buildStandardMathCommands()

/** List callable functions and constants from the installed CE standard library. */
export function listStandardMathCommands(): MathCommandInfo[] {
  return standardMathCommands.map(command => ({ ...command }))
}

function buildStandardMathCommands(): MathCommandInfo[] {
  const commands = new Map<string, MathCommandInfo>()
  const libraries = ComputeEngine.getStandardLibrary("all") as unknown as RawLibrary[]

  for (const library of libraries) {
    const definitions = Array.isArray(library.definitions)
      ? library.definitions.flatMap(definition => Object.entries(asRecord(definition)))
      : Object.entries(asRecord(library.definitions))

    for (const [name, rawDefinition] of definitions) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) continue
      const definition = asRecord(rawDefinition) as RawDefinition
      const signature = typeof definition.signature === "string" ? definition.signature : undefined
      const isConstant =
        definition.isConstant === true ||
        Object.hasOwn(definition, "value") ||
        typeof definition.type === "string"
      if (!signature && !isConstant) continue

      const command: MathCommandInfo = {
        name,
        kind: signature ? "function" : "constant",
        category: library.name,
        signature,
        description:
          typeof definition.description === "string"
            ? definition.description
            : (signature ?? `Compute Engine ${library.name} symbol`),
        properties: ["associative", "commutative", "idempotent"].filter(
          property => definition[property as keyof RawDefinition] === true,
        ),
        complexity: typeof definition.complexity === "number" ? definition.complexity : undefined,
        wikidata: typeof definition.wikidata === "string" ? definition.wikidata : undefined,
      }
      const previous = commands.get(name)
      if (!previous || (previous.kind === "constant" && command.kind === "function")) {
        commands.set(name, command)
      }
    }
  }

  return [...commands.values()].sort(
    (left, right) =>
      left.category.localeCompare(right.category) || left.name.localeCompare(right.name),
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
