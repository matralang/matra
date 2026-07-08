# Matra Language Support for VS Code

[English](./README.md) | [日本語](./README.ja.md)

[Matra](https://github.com/matralang/matra)向けのVS Code language supportです。

## Features

- function syntaxとblock syntaxのsyntax highlighting
- selector、attribute、literal、comment、`{{interpolation}}`のhighlighting
- **Format Document**によるdocument formatting
- Matra elementのOutline symbols
- nested elementとcommentのfolding ranges
- element、directive、Matra literal向けのhover help
- unmatched bracket / commentのlive diagnostics
- bracket matching、auto-closing pair、indentation
- element、directive、interpolation向けsnippets

## Development

VS Codeで`packages/vscode`を開き、**Developer: Run Extension**を実行するか、<kbd>F5</kbd>を押してExtension Development Hostを起動します。任意の`.matra` fileを開くとlanguage supportを試せます。

Repository rootからextension metadataの検証とtestを実行します。

```sh
npm run check -w matra-vscode
npm test -w matra-vscode
```
