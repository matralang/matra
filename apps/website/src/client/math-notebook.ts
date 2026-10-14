import {
  evaluateMatra,
  listStandardMathCommands,
  morphionize,
  numericEvaluateMatra,
  simplifyMatra,
} from "@matra/math-compute-engine"
import { parseMath } from "@matra/math"
import type { MathCommandInfo } from "@matra/math-compute-engine"

type MathCommand = MathCommandInfo

type MathCell = {
  id: number
  input: HTMLTextAreaElement
  output: HTMLElement
  completion: HTMLElement
  completionIndex: number
}

const commands = listStandardMathCommands()

const notebook = required<HTMLElement>("notebook-cells")
const status = required<HTMLElement>("math-page-status")
const referencePanel = required<HTMLElement>("reference-panel")
const examplesPanel = required<HTMLElement>("examples-panel")
const referenceTab = required<HTMLButtonElement>("reference-tab")
const examplesTab = required<HTMLButtonElement>("examples-tab")
const cells: MathCell[] = []
let nextCellId = 1
let activeCell: MathCell | undefined

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing Math Notebook element: ${id}`)
  return element as T
}

function createCell(source = ""): MathCell {
  const id = nextCellId++
  const article = document.createElement("article")
  article.className = "notebook-cell"
  article.setAttribute("aria-label", `Input cell ${id}`)

  const header = document.createElement("header")
  header.className = "notebook-cell-header"
  const prompt = document.createElement("strong")
  prompt.textContent = `In[${id}]:=`
  const run = document.createElement("button")
  run.type = "button"
  run.textContent = "Evaluate"
  run.setAttribute("aria-label", `Evaluate input ${id}`)
  const remove = document.createElement("button")
  remove.type = "button"
  remove.textContent = "Remove"
  remove.setAttribute("aria-label", `Remove input ${id}`)
  header.append(prompt, run, remove)

  const inputWrap = document.createElement("div")
  inputWrap.className = "notebook-input-wrap"
  const input = document.createElement("textarea")
  input.className = "notebook-input"
  input.rows = 2
  input.spellcheck = false
  input.value = source
  input.setAttribute("aria-label", `Math expression ${id}`)
  const completion = document.createElement("div")
  completion.className = "completion-list"
  completion.setAttribute("role", "listbox")
  completion.setAttribute("aria-label", "Command suggestions")
  completion.hidden = true
  inputWrap.append(input, completion)

  const output = document.createElement("div")
  output.className = "notebook-output"
  output.hidden = true
  article.append(header, inputWrap, output)
  notebook.append(article)

  const cell: MathCell = { id, input, output, completion, completionIndex: -1 }
  cells.push(cell)
  run.addEventListener("click", () => evaluateCell(cell))
  remove.addEventListener("click", () => removeCell(cell))
  input.addEventListener("focus", () => { activeCell = cell })
  input.addEventListener("input", () => {
    cell.output.hidden = true
    updateCompletions(cell)
  })
  input.addEventListener("keydown", event => handleInputKeydown(event, cell))
  return cell
}

function removeCell(cell: MathCell): void {
  if (cells.length === 1) {
    cell.input.value = ""
    cell.output.hidden = true
    cell.output.replaceChildren()
    setStatus("Cell cleared")
    return
  }
  const index = cells.indexOf(cell)
  if (index < 0) return
  cells.splice(index, 1)
  cell.input.closest(".notebook-cell")?.remove()
  if (activeCell === cell) activeCell = cells[Math.max(0, index - 1)]
  setStatus("Cell removed")
}

function evaluateCell(cell: MathCell): void {
  const expression = cell.input.value.trim()
  if (!expression) {
    cell.output.hidden = true
    cell.output.replaceChildren()
    setStatus("Enter an expression")
    return
  }
  const results = [
    evaluateResult("Evaluate", () => evaluateMatra(expression)),
    evaluateResult("Simplify", () => simplifyMatra(expression)),
    evaluateResult("Numeric", () => numericEvaluateMatra(expression), true),
    evaluateResult("Morphion", () => morphionize(parseMath(expression))),
  ]
  const grid = document.createElement("div")
  grid.className = "notebook-result-grid"
  for (const result of results) {
    const item = document.createElement("div")
    item.className = `notebook-result${result.error ? " is-error" : ""}`
    const label = document.createElement("span")
    label.className = "notebook-result-label"
    label.textContent = result.label
    const value = document.createElement("code")
    value.textContent = result.value
    item.append(label, value)
    grid.append(item)
  }
  cell.output.replaceChildren(grid)
  cell.output.hidden = false
  setStatus(`Evaluated cell ${cells.indexOf(cell) + 1}`)
}

function evaluateResult(label: string, run: () => unknown, numeric = false): { label: string; value: string; error: boolean } {
  try {
    return { label, value: formatValue(run(), numeric), error: false }
  } catch (error) {
    return {
      label,
      value: error instanceof Error ? error.message : String(error),
      error: true,
    }
  }
}

function formatValue(value: unknown, numeric = false): string {
  if (Array.isArray(value) && value[0] === "Complex" && value.length === 3) {
    return formatComplex(value[1], value[2], numeric)
  }
  if (Array.isArray(value) && value[0] === "Rational" && typeof value[1] === "number" && typeof value[2] === "number") {
    return formatRational(BigInt(value[1]), BigInt(value[2]), numeric)
  }
  if (typeof value === "string") {
    const recurring = value.match(/^(-?)(\d*)\.(\d*)\((\d+)\)$/)
    if (recurring) {
      const [, sign, integerPart, nonRepeating, repeating] = recurring
      const scale = 10n ** BigInt(nonRepeating.length)
      const cycle = 10n ** BigInt(repeating.length) - 1n
      const denominator = scale * cycle
      const whole = BigInt(integerPart || "0")
      let numerator = whole * denominator + BigInt(nonRepeating || "0") * cycle + BigInt(repeating)
      if (sign === "-") numerator = -numerator
      return formatRational(numerator, denominator, numeric)
    }
    return value
  }
  return JSON.stringify(value, null, 2) ?? String(value)
}

function formatComplex(real: unknown, imaginary: unknown, numeric: boolean): string {
  const realPart = signedPart(real, numeric)
  const imaginaryPart = signedPart(imaginary, numeric)
  if (imaginaryPart.text === "0") return `${realPart.negative ? "-" : ""}${realPart.text}`

  const imaginaryTerm = imaginaryPart.text === "1" ? "i" : `${imaginaryPart.text}i`
  if (realPart.text === "0") return `${imaginaryPart.negative ? "-" : ""}${imaginaryTerm}`
  return `${realPart.negative ? "-" : ""}${realPart.text} ${imaginaryPart.negative ? "-" : "+"} ${imaginaryTerm}`
}

function signedPart(value: unknown, numeric: boolean): { negative: boolean; text: string } {
  if (typeof value === "number") {
    return { negative: value < 0, text: formatValue(Math.abs(value), numeric) }
  }
  if (Array.isArray(value) && value[0] === "Rational" && typeof value[1] === "number" && typeof value[2] === "number") {
    return {
      negative: value[1] < 0,
      text: formatRational(BigInt(Math.abs(value[1])), BigInt(value[2]), numeric),
    }
  }
  if (typeof value === "string" && value.startsWith("-")) {
    return { negative: true, text: value.slice(1) }
  }
  return { negative: false, text: formatValue(value, numeric) }
}

function formatRational(numerator: bigint, denominator: bigint, numeric: boolean): string {
  if (denominator === 0n) return "Undefined"
  const divisor = greatestCommonDivisor(numerator, denominator)
  const reducedNumerator = numerator / divisor
  const reducedDenominator = denominator / divisor
  if (!numeric) {
    return reducedDenominator === 1n ? String(reducedNumerator) : `${reducedNumerator}/${reducedDenominator}`
  }
  const approximation = Number(reducedNumerator) / Number(reducedDenominator)
  return Number.isFinite(approximation) ? String(approximation) : `${reducedNumerator}/${reducedDenominator}`
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left
  let b = right < 0n ? -right : right
  while (b !== 0n) [a, b] = [b, a % b]
  return a || 1n
}

function evaluateAll(): void {
  for (const cell of cells) evaluateCell(cell)
  setStatus(`Evaluated ${cells.length} cells`)
}

function updateCompletions(cell: MathCell, showAll = false): void {
  const cursor = cell.input.selectionStart
  const prefix = cell.input.value.slice(0, cursor)
  const token = prefix.match(/[A-Za-z][A-Za-z0-9_]*$/)?.[0] ?? ""
  if (!showAll && (!token || prefix.endsWith("(") || cell.input.value[cursor] === "(")) {
    hideCompletions(cell)
    return
  }
  const matches = commands
    .filter(command => !token || command.name.toLowerCase().startsWith(token.toLowerCase()))
    .slice(0, 7)
  if (matches.length === 0) {
    hideCompletions(cell)
    return
  }
  cell.completion.replaceChildren()
  cell.completionIndex = 0
  for (const [index, command] of matches.entries()) {
    const option = document.createElement("button")
    option.type = "button"
    option.className = `completion-option${index === 0 ? " active" : ""}`
    option.setAttribute("role", "option")
    option.setAttribute("aria-selected", String(index === 0))
    const name = document.createElement("code")
    name.textContent = command.name
    const description = document.createElement("span")
    description.textContent = command.description
    option.append(name, description)
    option.addEventListener("mousedown", event => event.preventDefault())
    option.addEventListener("click", () => insertCommand(cell, command))
    cell.completion.append(option)
  }
  cell.completion.hidden = false
  cell.input.setAttribute("aria-expanded", "true")
}

function hideCompletions(cell: MathCell): void {
  cell.completion.hidden = true
  cell.input.setAttribute("aria-expanded", "false")
  cell.completionIndex = -1
}

function insertCommand(cell: MathCell, command: MathCommand): void {
  const cursor = cell.input.selectionStart
  const prefix = cell.input.value.slice(0, cursor)
  const token = prefix.match(/[A-Za-z][A-Za-z0-9_]*$/)?.[0] ?? ""
  const start = cursor - token.length
  const insertion = command.kind === "function" ? `${command.name}()` : command.name
  cell.input.setRangeText(insertion, start, cursor, "end")
  const nextCursor = start + command.name.length + (command.kind === "function" ? 1 : 0)
  cell.input.setSelectionRange(nextCursor, nextCursor)
  hideCompletions(cell)
  cell.input.focus()
}

function handleInputKeydown(event: KeyboardEvent, cell: MathCell): void {
  if (event.shiftKey && event.key === "Enter") {
    event.preventDefault()
    hideCompletions(cell)
    evaluateCell(cell)
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.code === "Space") {
    event.preventDefault()
    updateCompletions(cell, true)
    return
  }
  if (cell.completion.hidden) return
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault()
    const options = [...cell.completion.querySelectorAll<HTMLButtonElement>(".completion-option")]
    const delta = event.key === "ArrowDown" ? 1 : -1
    cell.completionIndex = (cell.completionIndex + delta + options.length) % options.length
    options.forEach((option, index) => {
      const active = index === cell.completionIndex
      option.classList.toggle("active", active)
      option.setAttribute("aria-selected", String(active))
    })
  } else if (event.key === "Enter" && cell.completionIndex >= 0) {
    event.preventDefault()
    const option = cell.completion.querySelectorAll<HTMLButtonElement>(".completion-option")[cell.completionIndex]
    const name = option?.querySelector("code")?.textContent
    const command = commands.find(candidate => candidate.name === name)
    if (command) insertCommand(cell, command)
  } else if (event.key === "Escape") {
    hideCompletions(cell)
  }
}

function insertReference(expression: string): void {
  if (!activeCell) activeCell = cells[0]
  if (!activeCell) return
  activeCell.input.value = expression
  activeCell.input.focus()
  hideCompletions(activeCell)
  evaluateCell(activeCell)
}

function renderReference(): void {
  const search = document.createElement("input")
  search.type = "search"
  search.className = "reference-search"
  search.placeholder = "Filter functions and constants"
  search.setAttribute("aria-label", "Filter function reference")
  const list = document.createElement("div")
  list.className = "reference-command-list"
  referencePanel.replaceChildren(search, list)

  const update = () => renderReferenceCommands(list, search.value)
  search.addEventListener("input", update)
  update()
}

function renderReferenceCommands(list: HTMLElement, filter: string): void {
  list.replaceChildren()
  const query = filter.trim().toLowerCase()
  const matches = commands.filter(command =>
    !query || `${command.name} ${command.category} ${command.description} ${command.signature ?? ""}`
      .toLowerCase()
      .includes(query),
  )
  let currentGroup = ""
  for (const command of matches) {
    if (command.category !== currentGroup) {
      currentGroup = command.category
      const heading = document.createElement("h2")
      heading.className = "reference-group"
      heading.textContent = currentGroup.replaceAll("-", " ")
      list.append(heading)
    }
    const item = document.createElement("button")
    item.type = "button"
    item.className = "reference-item"
    item.setAttribute("aria-label", `Insert ${command.name}`)
    const name = document.createElement("strong")
    name.textContent = command.name
    const expression = document.createElement("code")
    expression.textContent = command.signature ?? command.name
    const description = document.createElement("small")
    description.textContent = command.description
    item.append(name, expression, description)
    item.addEventListener("click", () => insertCommandFromReference(command))
    list.append(item)
  }
  if (matches.length === 0) {
    const empty = document.createElement("p")
    empty.className = "reference-empty"
    empty.textContent = "No matching commands"
    list.append(empty)
  }
}

function insertCommandFromReference(command: MathCommand): void {
  if (!activeCell) activeCell = createCell()
  activeCell.input.focus()
  insertCommand(activeCell, command)
}

function renderExamples(): void {
  examplesPanel.replaceChildren()
  const examples = [
    { title: "Exact arithmetic", source: "Add(Divide(1, 3), Divide(1, 6))" },
    { title: "Trigonometry", source: "Sin(Divide(Pi, 6))" },
    { title: "Symbolic expression", source: "Add(Power(x, 2), Multiply(2, x), 1)" },
    { title: "Simplification", source: "Add(Multiply(x, y), Multiply(x, y))" },
    { title: "Complex addition", source: "Add(Complex(1, 2), Complex(3, -4))" },
    { title: "Complex multiplication", source: "Multiply(Complex(1, 2), Complex(3, 4))" },
    { title: "Imaginary unit", source: "Power(ImaginaryUnit, 2)" },
    { title: "Morphion basis", source: "Add(Sin(x), Cos(x), Power(x, 2))" },
  ]
  for (const example of examples) {
    const item = document.createElement("button")
    item.type = "button"
    item.className = "reference-item"
    item.setAttribute("aria-label", `Insert ${example.title} example`)
    const title = document.createElement("strong")
    title.textContent = example.title
    const expression = document.createElement("code")
    expression.textContent = example.source
    item.append(title, expression)
    item.addEventListener("click", () => insertReference(example.source))
    examplesPanel.append(item)
  }
}

function selectReferenceTab(tab: HTMLButtonElement): void {
  const showExamples = tab === examplesTab
  referenceTab.classList.toggle("active", !showExamples)
  examplesTab.classList.toggle("active", showExamples)
  referenceTab.setAttribute("aria-selected", String(!showExamples))
  examplesTab.setAttribute("aria-selected", String(showExamples))
  referencePanel.hidden = showExamples
  examplesPanel.hidden = !showExamples
}

function setStatus(message: string): void {
  status.textContent = message
}

required<HTMLButtonElement>("run-all").addEventListener("click", evaluateAll)
required<HTMLButtonElement>("add-cell").addEventListener("click", () => {
  const cell = createCell()
  activeCell = cell
  cell.input.focus()
  setStatus("Cell added")
})
referenceTab.addEventListener("click", () => selectReferenceTab(referenceTab))
examplesTab.addEventListener("click", () => selectReferenceTab(examplesTab))
renderReference()
renderExamples()
for (const expression of ["Add(Power(2, 10), Factorial(5))", "Add(x, x)"]) {
  createCell(expression)
}
evaluateAll()