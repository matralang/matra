import { isMatraAST, type MatraAST, type MatraPropValue, type MatraValue } from "@matra/core"
import { CommandValidationError } from "./errors.js"
import type {
  CommandCapabilities,
  CommandOutputFormat,
  CommandSpec,
  CommandStderrMode,
  ExecutionPlan,
} from "./types.js"

const OUTPUT_FORMATS = new Set<CommandOutputFormat>(["text", "json", "ndjson", "binary"])
const STDERR_MODES = new Set<CommandStderrMode>(["text", "ignore"])
const COMMAND_PROPS = new Set([
  "id", "program", "args", "cwd", "env", "stdin", "stdout", "stderr",
  "timeout", "allowFail", "bind", "requires", "produces", "capabilities",
])
const CAPABILITY_PROPS = new Set(["commands", "read", "write", "network"])

/** Validate command nodes and compile them into a deterministic execution plan. */
export function planCommands(ast: MatraAST): ExecutionPlan {
  const nodes: MatraAST[] = []
  collectCommands(ast, nodes)
  const commands = nodes.map((node, index) => commandFromNode(node, index))
  validateNames(commands)
  const ordered = topologicalSort(commands)
  return {
    version: 1,
    commands: ordered,
    capabilities: mergeCapabilities(ordered.map(command => command.capabilities)),
  }
}

function collectCommands(node: MatraAST, output: MatraAST[]): void {
  if (node.tag === "command") output.push(node)
  for (const child of node.children) {
    if (isMatraAST(child)) collectCommands(child, output)
  }
}

function commandFromNode(node: MatraAST, index: number): CommandSpec {
  if (node.children.length > 0) fail("command does not accept children in protocol v0.1", node)
  for (const [key, value] of Object.entries(node.props)) {
    if (!COMMAND_PROPS.has(key)) fail(`Unknown command prop: ${key}`, node)
    if (isMatraAST(value)) fail("command props must be evaluated before planning", node)
  }

  const program = requiredString(node.props.program, "program", node)
  const bind = optionalString(node.props.bind, "bind", node)
  const id = optionalString(node.props.id, "id", node) ?? bind ?? `command-${index + 1}`
  const stdout = optionalString(node.props.stdout, "stdout", node) ?? "text"
  if (!OUTPUT_FORMATS.has(stdout as CommandOutputFormat)) {
    fail(`command stdout must be one of: ${[...OUTPUT_FORMATS].join(", ")}`, node)
  }
  const stderr = optionalString(node.props.stderr, "stderr", node) ?? "text"
  if (!STDERR_MODES.has(stderr as CommandStderrMode)) {
    fail(`command stderr must be one of: ${[...STDERR_MODES].join(", ")}`, node)
  }

  const capabilities = objectValue(node.props.capabilities, "capabilities", node)
  for (const key of Object.keys(capabilities ?? {})) {
    if (!CAPABILITY_PROPS.has(key)) fail(`Unknown command capability: ${key}`, node)
  }
  const cwd = optionalString(node.props.cwd, "cwd", node)
  const produces = stringArray(node.props.produces, "produces", node)
  return {
    id,
    program,
    args: stringArray(node.props.args, "args", node),
    ...optionalField("cwd", cwd),
    env: stringRecord(node.props.env, "env", node),
    ...optionalField("stdin", plainValue(node.props.stdin, "stdin", node)),
    stdout: stdout as CommandOutputFormat,
    stderr: stderr as CommandStderrMode,
    ...optionalField("timeout", optionalNonNegativeNumber(node.props.timeout, "timeout", node)),
    allowFail: optionalBoolean(node.props.allowFail, "allowFail", node) ?? false,
    ...optionalField("bind", bind),
    requires: stringArray(node.props.requires, "requires", node),
    produces,
    capabilities: {
      commands: unique([program, ...stringArray(capabilities?.commands, "capabilities.commands", node)]),
      read: unique([...(cwd ? [cwd] : []), ...stringArray(capabilities?.read, "capabilities.read", node)]),
      write: unique([...produces, ...stringArray(capabilities?.write, "capabilities.write", node)]),
      network: optionalBoolean(capabilities?.network, "capabilities.network", node) ?? false,
    },
    ...optionalField("position", node.position),
  }
}

function validateNames(commands: CommandSpec[]): void {
  const names = new Map<string, string>()
  for (const command of commands) {
    for (const name of unique([command.id, ...(command.bind ? [command.bind] : [])])) {
      const owner = names.get(name)
      if (owner && owner !== command.id) throw new CommandValidationError(`Duplicate command id or binding: ${name} (${owner}, ${command.id})`, command.position)
      names.set(name, command.id)
    }
  }
  for (const command of commands) {
    for (const dependency of command.requires) {
      if (!names.has(dependency)) {
        throw new CommandValidationError(`Unknown dependency ${dependency} required by ${command.id}`, command.position)
      }
    }
  }
}

function topologicalSort(commands: CommandSpec[]): CommandSpec[] {
  const byName = new Map<string, CommandSpec>()
  for (const command of commands) {
    byName.set(command.id, command)
    if (command.bind) byName.set(command.bind, command)
  }
  const state = new Map<string, "visiting" | "visited">()
  const output: CommandSpec[] = []

  const visit = (command: CommandSpec): void => {
    const current = state.get(command.id)
    if (current === "visiting") throw new CommandValidationError(`Command dependency cycle at ${command.id}`, command.position)
    if (current === "visited") return
    state.set(command.id, "visiting")
    for (const dependency of command.requires) visit(byName.get(dependency)!)
    state.set(command.id, "visited")
    output.push(command)
  }
  commands.forEach(visit)
  return output
}

function mergeCapabilities(values: CommandCapabilities[]): CommandCapabilities {
  return {
    commands: unique(values.flatMap(value => value.commands)),
    read: unique(values.flatMap(value => value.read)),
    write: unique(values.flatMap(value => value.write)),
    network: values.some(value => value.network),
  }
}

function requiredString(value: MatraPropValue | undefined, key: string, node: MatraAST): string {
  const result = optionalString(value, key, node)
  if (result === undefined || result.length === 0) fail(`command ${key} must be a non-empty string`, node)
  return result
}

function optionalString(value: MatraPropValue | undefined, key: string, node: MatraAST): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "string") fail(`command ${key} must be a string`, node)
  return value
}

function optionalBoolean(value: MatraPropValue | undefined, key: string, node: MatraAST): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "boolean") fail(`command ${key} must be a boolean`, node)
  return value
}

function optionalNonNegativeNumber(value: MatraPropValue | undefined, key: string, node: MatraAST): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`command ${key} must be a non-negative finite number`, node)
  return value
}

function stringArray(value: MatraPropValue | undefined, key: string, node: MatraAST): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(item => typeof item === "string")) fail(`command ${key} must be an array of strings`, node)
  return [...value] as string[]
}

function stringRecord(value: MatraPropValue | undefined, key: string, node: MatraAST): Record<string, string> {
  if (value === undefined) return {}
  const result = objectValue(value, key, node)
  if (!result || !Object.values(result).every(item => typeof item === "string")) fail(`command ${key} must be an object of strings`, node)
  return { ...result } as Record<string, string>
}

function objectValue(value: MatraPropValue | undefined, key: string, node: MatraAST): Record<string, MatraValue> | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "object" || value === null || Array.isArray(value) || isMatraAST(value)) fail(`command ${key} must be an object`, node)
  return value as Record<string, MatraValue>
}

function plainValue(value: MatraPropValue | undefined, key: string, node: MatraAST): MatraValue | undefined {
  if (value === undefined) return undefined
  if (isMatraAST(value)) fail(`command ${key} must be evaluated before planning`, node)
  return value
}

function optionalField<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return value === undefined ? {} : { [key]: value } as { [P in K]?: V }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function fail(message: string, node: MatraAST): never {
  throw new CommandValidationError(message, node.position)
}
