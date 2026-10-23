import type { UnifiedModule } from "../unified.js"
import { parseUnified } from "../unified.js"

/** Parse unified Matra source. `options` was removed with the v0.3 grammar. */
export function parse(source: string): UnifiedModule {
  return parseUnified(source)
}
