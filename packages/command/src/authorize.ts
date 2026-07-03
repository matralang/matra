import path from "node:path"
import { CommandAuthorizationError } from "./errors.js"
import type {
  AuthorizedExecutionPlan,
  CapabilityPolicy,
  ExecutionPlan,
} from "./types.js"

/** Check every requested capability and return an executable authorized plan. */
export function authorizePlan(
  plan: ExecutionPlan,
  policy: CapabilityPolicy,
): AuthorizedExecutionPlan {
  const violations: string[] = []
  checkNames("command", plan.capabilities.commands, policy.commands, violations)
  checkPaths("read", plan.capabilities.read, policy.read, violations)
  checkPaths("write", plan.capabilities.write, policy.write, violations)
  if (plan.capabilities.network && policy.network !== true) {
    violations.push("network access is not allowed")
  }
  if (violations.length > 0) throw new CommandAuthorizationError(violations)
  return {
    ...plan,
    authorization: { authorized: true, policy: clonePolicy(policy) },
  }
}

function checkNames(
  kind: string,
  requested: string[],
  allowed: readonly string[] | "*" | undefined,
  violations: string[],
): void {
  if (allowed === "*") return
  const set = new Set(allowed ?? [])
  for (const value of requested) {
    if (!set.has(value)) violations.push(`${kind} is not allowed: ${value}`)
  }
}

function checkPaths(
  kind: string,
  requested: string[],
  allowed: readonly string[] | "*" | undefined,
  violations: string[],
): void {
  if (allowed === "*") return
  const roots = (allowed ?? []).map(root => path.resolve(root))
  for (const value of requested) {
    const target = path.resolve(value)
    if (!roots.some(root => target === root || target.startsWith(`${root}${path.sep}`))) {
      violations.push(`${kind} path is not allowed: ${value}`)
    }
  }
}

function clonePolicy(policy: CapabilityPolicy): CapabilityPolicy {
  return {
    commands: policy.commands === "*" ? "*" : [...(policy.commands ?? [])],
    read: policy.read === "*" ? "*" : [...(policy.read ?? [])],
    write: policy.write === "*" ? "*" : [...(policy.write ?? [])],
    network: policy.network ?? false,
  }
}
