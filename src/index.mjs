/**
 * @butchi/matra-core
 * Matra Language Core - Parser and Runtime
 */

import { parse } from './parser.mjs'

export { parse }

// Version info
export const VERSION = '0.6.0'

// Re-export for convenience
export default {
  parse,
  VERSION,
}
