"use strict"

const pairs = { "{": "}", "[": "]", "(": ")" }
const closing = new Set(Object.values(pairs))

function positionAt(text, offset) {
  const before = text.slice(0, offset)
  const lines = before.split("\n")
  return { line: lines.length - 1, character: lines.at(-1).length }
}

/** Mask strings and comments while retaining offsets and line breaks. */
function maskSource(text) {
  const chars = [...text]
  let quote = null
  let comment = false

  for (let i = 0; i < chars.length; i += 1) {
    if (!quote && !comment && text.startsWith("<!--", i)) {
      comment = true
      for (let j = 0; j < 4; j += 1) chars[i + j] = " "
      i += 3
      continue
    }
    if (comment) {
      if (text.startsWith("-->", i)) {
        for (let j = 0; j < 3; j += 1) chars[i + j] = " "
        i += 2
        comment = false
      } else if (chars[i] !== "\n") chars[i] = " "
      continue
    }
    if (!quote && ['"', "`", "~"].includes(chars[i])) {
      quote = chars[i]
      chars[i] = " "
      continue
    }
    if (quote) {
      if (chars[i] === quote) quote = null
      if (chars[i] !== "\n") chars[i] = " "
    }
  }
  return chars.join("")
}

function analyze(text) {
  const masked = maskSource(text)
  const stack = []
  const errors = []
  const folds = []

  for (let offset = 0; offset < masked.length; offset += 1) {
    const char = masked[offset]
    if (pairs[char]) {
      stack.push({ char, offset })
    } else if (closing.has(char)) {
      const opener = stack.at(-1)
      if (!opener || pairs[opener.char] !== char) {
        errors.push({ offset, length: 1, message: `対応する開き括弧がない「${char}」です。` })
      } else {
        stack.pop()
        const start = positionAt(text, opener.offset)
        const end = positionAt(text, offset)
        if (end.line > start.line) folds.push({ start: start.line, end: end.line })
      }
    }
  }
  for (const opener of stack) {
    errors.push({
      offset: opener.offset,
      length: 1,
      message: `「${opener.char}」に対応する閉じ括弧「${pairs[opener.char]}」がありません。`,
    })
  }

  const commentStack = []
  for (let offset = 0; offset < text.length;) {
    if (text.startsWith("<!--", offset)) {
      commentStack.push(offset)
      offset += 4
    } else if (text.startsWith("-->", offset)) {
      const startOffset = commentStack.pop()
      if (startOffset === undefined) {
        errors.push({ offset, length: 3, message: "対応する開始記号がないコメント終了記号です。" })
      } else {
        const start = positionAt(text, startOffset)
        const end = positionAt(text, offset)
        if (end.line > start.line) folds.push({ start: start.line, end: end.line })
      }
      offset += 3
    } else offset += 1
  }
  for (const offset of commentStack) {
    errors.push({ offset, length: 4, message: "コメントが閉じられていません。" })
  }

  const symbols = []
  const tagPattern = /(^|[\s{,(])([^\s`~"'()\[\]{}<>=|#.,]+)(?=\s*(?:\(|\{|[.#\[]))/gmu
  for (const match of masked.matchAll(tagPattern)) {
    const name = match[2]
    if (["true", "false", "null"].includes(name)) continue
    const offset = match.index + match[1].length
    symbols.push({ name, offset, length: name.length })
  }

  return { errors, folds, symbols }
}

function format(text, options = {}) {
  const unit = options.insertSpaces === false ? "\t" : " ".repeat(options.tabSize || 2)
  const sourceLines = text.split(/\r?\n/)
  const maskedLines = maskSource(text).split(/\r?\n/)
  let level = 0

  const output = sourceLines.map((sourceLine, index) => {
    if (!sourceLine.trim()) return ""
    const structural = maskedLines[index] || ""
    const leadingClosers = structural.trimStart().match(/^[)}\]]+/)?.[0].length || 0
    const indent = Math.max(0, level - leadingClosers)
    const opens = (structural.match(/[({\[]/g) || []).length
    const closes = (structural.match(/[)}\]]/g) || []).length
    level = Math.max(0, level + opens - closes)
    return unit.repeat(indent) + sourceLine.trim()
  })

  return output.join("\n")
}

module.exports = { analyze, format, maskSource, positionAt }
