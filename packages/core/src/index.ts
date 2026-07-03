/** @matra/core — domain-neutral Matra tree primitives. */

export { parse, parseWith } from "./parser/index.js"
export {
  astToMatraJSON,
  isMatraAST,
  isMatraJSON,
  matraJSONToAST,
} from "./ast/convert.js"
export { printJSON } from "./printer.js"
export { transform, visit } from "./ast/transform.js"
export { renderWith } from "./render.js"
export type { MatraRenderer } from "./render.js"
export { evaluateStandard, Map, Range } from "./standard.js"
export type { StandardEvaluationOptions, StandardFunction } from "./standard.js"
export { CORE_VERSION, SPEC_VERSION } from "./ast/types.js"
export type * from "./ast/types.js"

import { parse, parseWith } from "./parser/index.js"
import { astToMatraJSON, matraJSONToAST } from "./ast/convert.js"
import { printJSON } from "./printer.js"
import { transform, visit } from "./ast/transform.js"
import { renderWith } from "./render.js"
import { evaluateStandard, Map, Range } from "./standard.js"
import { CORE_VERSION } from "./ast/types.js"

export const VERSION = CORE_VERSION

export default {
  parse,
  parseWith,
  astToMatraJSON,
  matraJSONToAST,
  printJSON,
  transform,
  visit,
  renderWith,
  evaluateStandard,
  Map,
  Range,
  VERSION,
}
