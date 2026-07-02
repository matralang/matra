#!/usr/bin/env node

/// <reference types="node" />

import {
  astToTeX,
  exprToFormulaNode,
  exprToMatraExprNode,
  evaluateMatra,
  numericEvaluateMatra,
  parseMatraMathJson,
  simplifyMatra,
  parseMatraExpr,
  parseMatraFormula,
  texToExpr,
} from "./index"
import { toExpression, toMorphionForm } from "./utils"

const args = process.argv.slice(2)

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`
bmath CLI

Usage:
  bmath "<matra>" [--operation OPERATION] [--input FORMAT] [--mode MODE] [--output FORMAT]

Options:
  --input      Input format: "matra" (default) or "tex"
  --operation  Compute operation: "evaluate" (default), "simplify", or "numeric"
  --mode       Output mode: "conventional" (default) or "consistent"
  --output     Output format: "result" (default), "mathjson", "tex", "expr", "formula", "morphion"

Examples:
  bmath 'Add(1, 2, 3)'
  bmath 'Add(1, 2, 3)' --output mathjson
  bmath 'Divide(1, 3)' --operation numeric
  bmath "x^2 + 1" --input tex
`)
  process.exit(0)
}

const input = args[0]
let inputFormat: "matra" | "tex" = "matra"
let operation: "evaluate" | "simplify" | "numeric" = "evaluate"
let mode: "conventional" | "consistent" = "conventional"
let outputFormat = "result"

for (let i = 1; i < args.length; i++) {
  if (args[i] === "--input") {
    inputFormat = (args[i + 1] as any) || "matra"
    i++
  } else if (args[i] === "--operation") {
    operation = (args[i + 1] as any) || "evaluate"
    i++
  } else if (args[i] === "--mode") {
    mode = (args[i + 1] as any) || "conventional"
    i++
  } else if (args[i] === "--output") {
    outputFormat = (args[i + 1] as any) || "tex"
    i++
  }
}

try {
  if (inputFormat !== "matra" && inputFormat !== "tex") {
    throw new Error(`Unknown input format: ${inputFormat}`)
  }
  if (operation !== "evaluate" && operation !== "simplify" && operation !== "numeric") {
    throw new Error(`Unknown operation: ${operation}`)
  }

  if (inputFormat === "matra" && outputFormat === "mathjson") {
    console.log(JSON.stringify(parseMatraMathJson(input)))
    process.exit(0)
  }

  if (inputFormat === "matra" && outputFormat === "result") {
    const operations = { evaluate: evaluateMatra, simplify: simplifyMatra, numeric: numericEvaluateMatra }
    console.log(JSON.stringify(operations[operation](input)))
    process.exit(0)
  }

  const expr = inputFormat === "tex" ? texToExpr(input) : (() => {
        try {
          return parseMatraExpr(input)
        } catch (exprError) {
          try {
            return parseMatraFormula(input)
          } catch {
            throw exprError
          }
        }
      })()

  let result: unknown

  if (outputFormat === "result") {
    result = astToTeX(exprToMatraExprNode(expr), mode)
  } else if (outputFormat === "tex") {
    result = astToTeX(exprToMatraExprNode(expr), mode)
  } else if (outputFormat === "expr") {
    result = toExpression(expr)
  } else if (outputFormat === "formula") {
    result = JSON.stringify(exprToFormulaNode(expr), null, 2)
  } else if (outputFormat === "morphion") {
    result = JSON.stringify(toMorphionForm(expr), null, 2)
  } else {
    throw new Error(`Unknown output format: ${outputFormat}`)
  }

  console.log(result)
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  console.error(`Input: ${input}`)
  process.exit(1)
}
