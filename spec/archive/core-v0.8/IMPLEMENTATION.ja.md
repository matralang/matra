# Matra v0.8 Implementation Summary

[English](./IMPLEMENTATION.md) | [日本語](./IMPLEMENTATION.ja.md)

> [!WARNING]
> この文書はCore v0.8実装のhistorical summaryです。現在のCore実装とは異なる場合があります。

## Overview

v0.8では、既存のblock syntaxに加えてfunction syntaxを導入しました。目標は、HTML treeをよりinlineに書ける構文を追加しつつ、既存template、directive、HAST-compatible outputとの互換性を維持することでした。

## Changes Made

### 1. Grammar Extension (`src/matra-parser.pegjs`)

PEG grammarにfunction callをparseするruleを追加しました。

- `TagApply`: `tag(...)`形式のentry point
- `ArgList`: comma-separated arguments
- `Arg`: string、number、boolean、object、nested callなど
- `BareObject`: `{key:"value"}`形式のproperties
- `Identifier`: tag名とproperty名

### 2. Parser Integration

`Block`のalternativeに`TagApply`を追加し、function syntaxとblock syntaxを同じAST shapeへ正規化する方針を取りました。

### 3. Test Suite

Function syntax、v0.7 compatibility、mixed syntaxを対象にtestを追加しました。意図は、既存syntaxを壊さず新構文を導入できていることを確認することです。

### 4. Documentation

Function syntax guide、quick reference、syntax comparison、demo examplesを整備しました。

## Test Results

v0.8時点のsummaryでは、新規testが通り、既存のblock syntaxも継続して動作することを確認していました。

## Examples

### Simple

```matra
p("Hello")
```

### With Properties

```matra
h1("Title", class="page-title")
```

### Nested

```matra
nav(ul(li("Home"), li("Docs")))
```

### Equivalent to Block Syntax

```matra
// Function
p("Hello")

// Block
p { "Hello" }
```

## Integration with Existing Features

### Template Variables (Mustache)

```matra
p("Hello, {{name}}")
```

### Directives (m-if, m-each)

```matra
ul(li("{{item}}", m-each="items", m-as="item"))
```

### HAST Output

Function syntaxとblock syntaxは同じHAST-compatible nodeへ変換されるため、rendererやtransformerは構文差を意識しない設計でした。

## Backward Compatibility

v0.7 block syntaxはそのままsupportされ、function syntaxは追加機能として導入されました。既存templateの書き換えは必須ではありません。

## Grammar Summary

```text
TagApply  -> Identifier "(" ArgList? ")"
ArgList   -> Arg ("," Arg)*
Arg       -> String / Number / Boolean / BareObject / TagApply
BareObject -> "{" PairList? "}"
```

## Files Modified

- parser grammar
- parser integration
- tests
- documentation

## Files Created

- function syntax guide
- quick reference
- syntax comparison
- implementation summary
- demo examples

## Next Steps (Optional Enhancements)

- keyword argument syntaxの拡張
- error messageの改善
- editor toolingの追随
- mixed syntaxのformatting rule整備

## Build Commands

```bash
# Regenerate parser from grammar
npm run build

# Run all tests
npm test

# Run demo
node examples/function-syntax-demo.mjs
```

## Conclusion

v0.8のfunction syntaxは、既存template ecosystemを保ちながら新しい表記を追加する実装でした。現在のMatraではdomain-neutral Coreへ進化しているため、この文書は設計変遷を理解するためのarchiveとして扱います。
