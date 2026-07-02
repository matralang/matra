"use strict"

const vscode = require("vscode")
const { analyze, format, positionAt } = require("./analyzer")

const selector = { language: "matra", scheme: "file" }

function toPosition(position) {
  return new vscode.Position(position.line, position.character)
}

function activate(context) {
  const diagnostics = vscode.languages.createDiagnosticCollection("matra")
  context.subscriptions.push(diagnostics)

  const updateDiagnostics = (document) => {
    if (document.languageId !== "matra") return
    const text = document.getText()
    const entries = analyze(text).errors.map((error) => {
      const start = toPosition(positionAt(text, error.offset))
      const end = toPosition(positionAt(text, error.offset + error.length))
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(start, end),
        error.message,
        vscode.DiagnosticSeverity.Error,
      )
      diagnostic.source = "Matra"
      return diagnostic
    })
    diagnostics.set(document.uri, entries)
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(updateDiagnostics),
    vscode.workspace.onDidChangeTextDocument(({ document }) => updateDiagnostics(document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
    vscode.languages.registerDocumentFormattingEditProvider(selector, {
      provideDocumentFormattingEdits(document, options) {
        const text = document.getText()
        const formatted = format(text, options)
        if (formatted === text) return []
        const end = document.positionAt(text.length)
        return [vscode.TextEdit.replace(new vscode.Range(new vscode.Position(0, 0), end), formatted)]
      },
    }),
    vscode.languages.registerDocumentSymbolProvider(selector, {
      provideDocumentSymbols(document) {
        const text = document.getText()
        return analyze(text).symbols.map((symbol) => {
          const start = document.positionAt(symbol.offset)
          const end = document.positionAt(symbol.offset + symbol.length)
          const range = new vscode.Range(start, end)
          return new vscode.DocumentSymbol(symbol.name, "Matra element", vscode.SymbolKind.Field, range, range)
        })
      },
    }),
    vscode.languages.registerFoldingRangeProvider(selector, {
      provideFoldingRanges(document) {
        return analyze(document.getText()).folds.map(
          ({ start, end }) => new vscode.FoldingRange(start, end),
        )
      },
    }),
    vscode.languages.registerHoverProvider(selector, {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position, /\$root|[A-Za-z_][A-Za-z0-9_-]*/)
        if (!range) return undefined
        const word = document.getText(range)
        const help = {
          "$root": "Matraドキュメントのルート要素です。",
          "m-if": "値が真のときだけ要素を描画する条件ディレクティブです。",
          "m-each": "配列の各要素について要素を繰り返すディレクティブです。",
          "m-as": "`m-each`内で各要素を参照する変数名を指定します。",
          true: "Matraの真偽値 `true` です。",
          false: "Matraの真偽値 `false` です。",
          null: "Matraの空値 `null` です。",
        }[word]
        const contents = help || `Matra要素 **${word}**`
        return new vscode.Hover(new vscode.MarkdownString(contents), range)
      },
    }),
  )

  for (const document of vscode.workspace.textDocuments) updateDiagnostics(document)
}

function deactivate() {}

module.exports = { activate, deactivate }
