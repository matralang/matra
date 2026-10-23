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

type ReferenceCategory = {
  id: string
  title: string
  description: string
}

const referenceCategories: ReferenceCategory[] = [
  { id: "core", title: "コアとなる言語と構成", description: "式、関数、論理・制御構造" },
  { id: "data", title: "データの操作と解析", description: "集合、統計、行列など" },
  { id: "graphics", title: "可視化とグラフィックス", description: "色、フラクタルなど" },
  { id: "symbolic", title: "記号・数値計算", description: "算術、代数、微積分、物理" },
  { id: "text", title: "文字列とテキスト", description: "文字列とテキストの処理" },
]

const referenceProperties: Record<string, string> = {
  associative: "結合的",
  commutative: "可換",
  idempotent: "冪等",
}

const _curatedExamples: Record<string, string> = {
  Add: "Add(x, 2, 3)",
  Subtract: "Subtract(x, 3)",
  Multiply: "Multiply(x, 2, 3)",
  Divide: "Divide(x, 3)",
  Power: "Power(x, 2)",
  Complex: "Complex(1, 2)",
  Sin: "Sin(Divide(Pi, 6))",
  Cos: "Cos(Divide(Pi, 3))",
  Factorial: "Factorial(5)",
  Mandelbrot: "Mandelbrot(0, 20)",
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
  input.addEventListener("focus", () => {
    activeCell = cell
  })
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

function evaluateResult(
  label: string,
  run: () => unknown,
  numeric = false,
): { label: string; value: string; error: boolean } {
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
  if (
    Array.isArray(value) &&
    value[0] === "Rational" &&
    typeof value[1] === "number" &&
    typeof value[2] === "number"
  ) {
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
  if (
    Array.isArray(value) &&
    value[0] === "Rational" &&
    typeof value[1] === "number" &&
    typeof value[2] === "number"
  ) {
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
    return reducedDenominator === 1n
      ? String(reducedNumerator)
      : `${reducedNumerator}/${reducedDenominator}`
  }
  const approximation = Number(reducedNumerator) / Number(reducedDenominator)
  return Number.isFinite(approximation)
    ? String(approximation)
    : `${reducedNumerator}/${reducedDenominator}`
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
    const option =
      cell.completion.querySelectorAll<HTMLButtonElement>(".completion-option")[
        cell.completionIndex
      ]
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
  search.placeholder = "関数・定数を検索"
  search.setAttribute("aria-label", "関数と定数を検索")
  const categories = document.createElement("div")
  categories.className = "reference-category-grid"
  const list = document.createElement("div")
  list.className = "reference-command-list"
  list.hidden = true
  const detail = document.createElement("div")
  detail.className = "reference-detail"
  detail.hidden = true
  referencePanel.replaceChildren(search, categories, list, detail)

  let currentCommands: MathCommand[] = []
  const browseCategory = (categoryId: string) => {
    currentCommands = commands.filter(command => referenceCategoryId(command) === categoryId)
    categories.hidden = true
    detail.hidden = true
    list.hidden = false
    renderReferenceCommands(
      list,
      currentCommands,
      referenceCategories.find(category => category.id === categoryId)?.title ?? "Reference",
      () => {
        search.value = ""
        list.hidden = true
        categories.hidden = false
        renderReferenceCategories(categories, browseCategory)
      },
      command => showCommandDetails(command),
    )
  }
  const showCommandDetails = (command: MathCommand) => {
    list.hidden = true
    categories.hidden = true
    detail.hidden = false
    renderCommandDetails(
      detail,
      command,
      currentCommands,
      () => {
        detail.hidden = true
        list.hidden = false
      },
      showCommandDetails,
    )
  }
  renderReferenceCategories(categories, browseCategory)

  const update = () => {
    const query = search.value.trim().toLowerCase()
    detail.hidden = true
    if (!query) {
      list.hidden = true
      categories.hidden = false
      renderReferenceCategories(categories, browseCategory)
      return
    }
    categories.hidden = true
    list.hidden = false
    currentCommands = commands.filter(command =>
      `${command.name} ${command.category} ${command.description} ${command.signature ?? ""}`
        .toLowerCase()
        .includes(query),
    )
    renderReferenceCommands(
      list,
      currentCommands,
      "検索結果",
      () => {
        search.value = ""
        update()
      },
      showCommandDetails,
    )
  }
  search.addEventListener("input", update)
}

function renderReferenceCategories(
  container: HTMLElement,
  onSelect: (categoryId: string) => void,
): void {
  container.replaceChildren()
  for (const category of referenceCategories) {
    const items = commands.filter(command => referenceCategoryId(command) === category.id)
    const button = document.createElement("button")
    button.type = "button"
    button.className = "reference-category"
    const title = document.createElement("strong")
    title.textContent = category.title
    const description = document.createElement("small")
    description.textContent = category.description
    const count = document.createElement("span")
    count.textContent = String(items.length)
    button.append(title, description, count)
    button.addEventListener("click", () => onSelect(category.id))
    container.append(button)
  }
}

function renderReferenceCommands(
  list: HTMLElement,
  items: MathCommand[],
  title: string,
  onBack: () => void,
  onSelect: (command: MathCommand) => void,
): void {
  list.replaceChildren()
  const back = document.createElement("button")
  back.type = "button"
  back.className = "reference-back"
  back.textContent = "← 分類へ戻る"
  back.addEventListener("click", onBack)
  const heading = document.createElement("h2")
  heading.className = "reference-category-title"
  heading.textContent = `${title} (${items.length})`
  list.append(back, heading)

  let currentGroup = ""
  for (const command of items) {
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
    item.setAttribute("aria-label", `詳細を表示: ${command.name}`)
    const name = document.createElement("strong")
    name.textContent = command.name
    const expression = document.createElement("code")
    expression.textContent = command.signature ?? command.name
    const example = document.createElement("small")
    example.className = "reference-summary-example"
    example.textContent = `例: ${commandExample(command)}`
    item.append(name, expression, example)
    item.addEventListener("click", () => onSelect(command))
    list.append(item)
  }
  if (items.length === 0) {
    const empty = document.createElement("p")
    empty.className = "reference-empty"
    empty.textContent = "該当する項目がありません"
    list.append(empty)
  }
}

function renderCommandDetails(
  container: HTMLElement,
  command: MathCommand,
  candidates: MathCommand[],
  onBack: () => void,
  onSelectRelated: (command: MathCommand) => void,
): void {
  container.replaceChildren()
  const back = document.createElement("button")
  back.type = "button"
  back.className = "reference-back"
  back.textContent = "← 項目一覧へ戻る"
  back.addEventListener("click", onBack)
  const title = document.createElement("h2")
  title.className = "reference-detail-title"
  title.textContent = command.name
  container.append(back, title)

  appendReferenceSection(container, "詳細", command.description)
  const exampleSection = createReferenceSection(container, "例題")
  const example = commandExample(command)
  const code = document.createElement("code")
  code.className = "reference-example-code"
  code.textContent = example
  const insert = document.createElement("button")
  insert.type = "button"
  insert.className = "reference-insert"
  insert.textContent = "Notebookへ入力"
  insert.addEventListener("click", () => insertReference(example))
  exampleSection.append(code, insert)

  appendReferenceSection(
    container,
    "スコープ",
    [
      command.kind === "constant" ? "定数" : "関数",
      `Compute Engine library: ${command.category}`,
      command.signature ? `Signature: ${command.signature}` : "引数を取らないsymbolです。",
    ].join("\n"),
  )
  appendReferenceSection(container, "一般化と拡張", generalizationDescription(command))
  appendReferenceSection(container, "特性と関係", characteristicsDescription(command))
  appendReferenceSection(container, "考えられる問題", potentialIssuesDescription(command))

  const relatedSection = createReferenceSection(container, "関連項目")
  const related = relatedCommands(command, candidates)
  if (related.length === 0) {
    relatedSection.append(document.createTextNode("関連項目はありません。"))
  } else {
    const list = document.createElement("div")
    list.className = "reference-related-list"
    for (const item of related) {
      const button = document.createElement("button")
      button.type = "button"
      button.className = "reference-related-item"
      button.textContent = item.name
      button.addEventListener("click", () => onSelectRelated(item))
      list.append(button)
    }
    relatedSection.append(list)
  }
}

function createReferenceSection(container: HTMLElement, title: string): HTMLElement {
  const section = document.createElement("section")
  section.className = "reference-detail-section"
  const heading = document.createElement("h3")
  heading.textContent = title
  section.append(heading)
  container.append(section)
  return section
}

function appendReferenceSection(container: HTMLElement, title: string, body: string): void {
  const section = createReferenceSection(container, title)
  const text = document.createElement("p")
  text.textContent = body
  section.append(text)
}

function commandExample(command: MathCommand): string {
  if (command.kind === "constant") return command.name
  const curated: Record<string, string> = {
    Add: "Add(x, 2, 3)",
    Subtract: "Subtract(x, 3)",
    Multiply: "Multiply(x, 2, 3)",
    Divide: "Divide(x, 3)",
    Power: "Power(x, 2)",
    Complex: "Complex(1, 2)",
    Sin: "Sin(Divide(Pi, 6))",
    Cos: "Cos(Divide(Pi, 3))",
    Factorial: "Factorial(5)",
    Mandelbrot: "Mandelbrot(0, 20)",
  }
  if (curated[command.name]) return curated[command.name]
  const signature = command.signature?.match(/^\((.*)\)\s*->/s)?.[1]
  if (signature === undefined) return `${command.name}()`
  const args = splitSignature(signature)
    .map(sampleArgument)
    .filter((argument): argument is string => argument !== undefined)
  return `${command.name}(${args.join(", ")})`
}

function splitSignature(signature: string): string[] {
  const parts: string[] = []
  let start = 0
  let depth = 0
  for (let index = 0; index < signature.length; index += 1) {
    const character = signature[index]
    if (character === "(" || character === "<" || character === "[") depth += 1
    else if (character === ")" || character === ">" || character === "]") depth -= 1
    else if (character === "," && depth === 0) {
      parts.push(signature.slice(start, index).trim())
      start = index + 1
    }
  }
  if (signature.slice(start).trim()) parts.push(signature.slice(start).trim())
  return parts
}

function sampleArgument(parameter: string): string | undefined {
  const source = parameter.replace(/^\w+\s*:\s*/, "").trim()
  if (source.endsWith("?")) return undefined
  const type = source.replace(/[+*?]$/, "").toLowerCase()
  if (type.includes("boolean")) return "True"
  if (type.includes("string")) return '"text"'
  if (type.includes("matrix")) return "Matrix(Vector(1, 2), Vector(3, 4))"
  if (type.includes("vector")) return "Vector(1, 2)"
  if (type.includes("list") || type.includes("collection")) return "List(1, 2)"
  if (type.includes("symbol")) return "x"
  if (type.includes("function")) return "Sin"
  if (type.includes("expression") || type.includes("any") || type.includes("value")) return "x"
  if (type.includes("integer")) return "2"
  if (type.includes("number") || type.includes("real")) return "1"
  if (source.endsWith("+") || source.endsWith("*")) return "x"
  return "x"
}

function generalizationDescription(command: MathCommand): string {
  const signature = command.signature ?? ""
  const notes: string[] = []
  if (signature.includes("+")) notes.push("`+`は1個以上の可変個引数を表します。")
  if (signature.includes("*")) notes.push("`*`は0個以上の可変個引数を表します。")
  if (signature.includes("?")) notes.push("`?`の引数は省略できます。")
  if (command.kind === "constant") notes.push("定数は他の式のoperandとして合成できます。")
  if (command.category === "arithmetic" || command.category === "trigonometry") {
    notes.push("他のMathJSON式を引数に取って再帰的に合成できます。")
  }
  return notes.length > 0
    ? notes.join("\n")
    : "Compute Engineのsignatureに定義された引数形式に従います。"
}

function characteristicsDescription(command: MathCommand): string {
  const properties = command.properties.map(property => referenceProperties[property] ?? property)
  if (command.complexity !== undefined) properties.push(`CE complexity: ${command.complexity}`)
  if (command.wikidata) properties.push(`Wikidata: ${command.wikidata}`)
  return properties.length > 0 ? properties.join(" / ") : "CE標準定義に追加の代数属性はありません。"
}

function potentialIssuesDescription(command: MathCommand): string {
  const signature = command.signature ?? ""
  const knownIssues: Record<string, string> = {
    Divide: "分母が0の場合、有限な数値結果は定義されません。分母を確認してください。",
    Log: "実数結果を期待する場合は、真数を正、底を正かつ1以外にしてください。",
    Ln: "実数結果を期待する場合は、引数を正にしてください。負の入力は複素数領域で評価されます。",
    Sqrt: "負の実数入力は実数ではなく複素数の主値になります。",
    Root: "偶数次の負の実数根は複素数の主値になる場合があります。",
    Tan: "極はπ/2 + kπ（kは整数）です。極付近の数値近似に注意してください。",
    Factorial: "Factorialの引数は非負整数を指定してください。",
  }
  if (knownIssues[command.name]) return knownIssues[command.name]
  if (signature.includes("matrix") || signature.includes("vector")) {
    return "行列・vectorのshapeと各行の次元が演算の条件を満たすか確認してください。"
  }
  return "引数の型・個数はsignatureを確認してください。評価できない式はErrorまたは未評価の記号式として返る場合があります。"
}

function relatedCommands(command: MathCommand, candidates: MathCommand[]): MathCommand[] {
  return candidates
    .filter(candidate => candidate.name !== command.name)
    .map(candidate => {
      const commonPrefix = candidate.name.slice(
        0,
        commonPrefixLength(candidate.name, command.name),
      ).length
      const sameNameStem = commandStem(candidate.name) === commandStem(command.name)
      const sharedProperties = candidate.properties.filter(property =>
        command.properties.includes(property),
      ).length
      const commandTypes = signatureTypes(command)
      const sharedTypes = [...signatureTypes(candidate)].filter(type =>
        commandTypes.has(type),
      ).length
      const sameCategory = candidate.category === command.category ? 1 : 0
      const sameKind = candidate.kind === command.kind ? 1 : 0
      const score =
        (sameNameStem ? 100 : 0) +
        (commonPrefix >= 3 ? commonPrefix * 3 : 0) +
        sharedProperties * 5 +
        sharedTypes * 2 +
        sameCategory +
        sameKind
      return { candidate, score }
    })
    .filter(item => item.score >= 3)
    .sort(
      (left, right) =>
        right.score - left.score || left.candidate.name.localeCompare(right.candidate.name),
    )
    .slice(0, 5)
    .map(item => item.candidate)
}

function commandStem(name: string): string {
  return name.replace(/\d+$/, "")
}

function signatureTypes(command: MathCommand): Set<string> {
  if (!command.signature) return new Set()
  const open = command.signature.indexOf("(")
  const close = command.signature.indexOf(")", open + 1)
  if (open < 0 || close < 0) return new Set()
  const parameters = splitSignature(command.signature.slice(open + 1, close)).map(parameter =>
    parameter
      .replace(/^\w+\s*:\s*/, "")
      .replace(/[+*?]$/, "")
      .toLowerCase(),
  )
  const result = command.signature
    .slice(close + 1)
    .split("->")[1]
    ?.trim()
    .toLowerCase()
  if (result) parameters.push(result)
  return new Set(parameters.filter(type => /^[a-z][a-z0-9_<>, ]*$/.test(type)))
}

function commonPrefixLength(left: string, right: string): number {
  let index = 0
  while (index < left.length && index < right.length && left[index] === right[index]) index += 1
  return index
}

function referenceCategoryId(command: MathCommand): string {
  const nameAndSignature = `${command.name} ${command.signature ?? ""}`.toLowerCase()
  if (command.category === "core" && /string|text/.test(nameAndSignature)) return "text"
  if (["core", "control-structures"].includes(command.category)) return "core"
  if (
    ["collections", "statistics", "linear-algebra", "number-theory", "polynomials"].includes(
      command.category,
    )
  )
    return "data"
  if (["colors", "fractals"].includes(command.category)) return "graphics"
  if (command.category === "strings") return "text"
  return "symbolic"
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
