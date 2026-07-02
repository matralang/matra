# Matra Language Support for VS Code

VS Code language support for [Matra](https://github.com/matralang/matra).

## Features

- Syntax highlighting for function and block syntax
- Highlighting for selectors, attributes, literals, comments, and `{{interpolation}}`
- Bracket matching, auto-closing pairs, indentation, and region folding
- Snippets for elements, directives, and interpolation

## Development

Open `packages/vscode` in VS Code and run **Developer: Run Extension** (or press
<kbd>F5</kbd>) to launch an Extension Development Host. Open any `.matra` file to
try the language support.

Validate the extension metadata and run its tests from the repository root:

```sh
npm run check -w matra-vscode
npm test -w matra-vscode
```
