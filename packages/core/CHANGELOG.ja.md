# Changelog

[English](./CHANGELOG.md) | [日本語](./CHANGELOG.ja.md)

`@matra/core`の主な変更を記録します。

このchangelogは[Keep a Changelog](https://keepachangelog.com/en/1.0.0/)の形式を参考にし、projectは[Semantic Versioning](https://semver.org/spec/v2.0.0.html)に従います。

## [0.8.0] - 2025-10-24

### Added

- **Function-style syntax**を追加しました。既存のblock-style syntaxと併用できます。
  - `p("Hello")` - simple element
  - `div({class:"container"}, ...)` - properties付きelement
  - `nav(ul(li(...), li(...)))` - nested function call
  - HAST互換の出力を保ち、block syntaxと同じnodeを生成します。
- 新しいPEG ruleでgrammarを拡張しました。
  - `TagApply` - function call parsingのmain rule
  - `ArgList` - comma-separated arguments
  - `Arg` - object、string、number、boolean、nested callなどのargument type
  - `BareObject` - property object literal `{key:"value"}`
  - `Identifier` - tag / property name
  - `Number` - numeric literal
  - `Boolean` - `true` / `false` literal
- propertiesでstring、number、boolean valueを扱えるようにしました。
- function syntax guide、quick reference、demo examplesを追加しました。
- function syntax、v0.7 compatibility、mixed syntaxを含むtest coverageを追加しました。

### Changed

- Parser rule priorityを変更し、`TagApply`を`Block`の最初のalternativeに追加しました。
- property objectとelement blockを区別できるようgrammarを更新しました。

### Fixed

- 互換性を壊す修正はありません。v0.7 syntaxはそのまま動作します。

### Documentation

- function syntax guide、syntax comparison、implementation summary、demo fileを整備しました。

### Notes

- **100% backward compatible**です。v0.7 syntaxは継続して利用できます。
- 両syntaxは同一のHAST nodeを生成します。
- `m-if`、`m-each`、`{{mustache}}`などのtemplate featureと併用できます。
- `transform.mjs`、`render.mjs`などの既存moduleに変更は不要です。

## [0.7.0] - 2025-10-23

### Added

- `transform()`でattribute-based directivesをsupportしました。
  - `m-if="condition"` - regular elementのconditional rendering
  - `m-each="items" m-as="item"` - regular elementのarray iteration
  - `m-else` attribute - `m-if`がfalsyのときのalternative content
  - 既存template syntaxとの互換性を維持しました。
- `with_()`でplain stringとtemplate literalを受け付けるようにしました。

### Changed

- `transformWithScopes()`をattribute directives優先で書き直しました。
- `transform()`がsingle node inputを正しく扱うようになりました。
- `toHTML()`にHAST / MDAST node type supportを追加しました。
- `render.mjs`にHAST format support用の`renderHastNode()`を追加しました。

### Fixed

- `m-else` siblingを含むattribute-based directivesが正しく動作するようにしました。
- falsyな`m-if` conditionから生じるempty resultを正しく扱うようにしました。
- nested `m-each` iterationのscope managementを修正しました。
- `with_()`のtemplate literal interpolationを修正しました。

## [0.6.0] - 2025-10-22

### Added

- Template transformation engine（`transform.mjs`）を追加しました。
  - tag-based directives: `m-if[test="..."]`, `m-each[of="..." as="..."]`, `m-else`
  - Mustache variable interpolation: `{{variable}}`, `{{object.property}}`
  - nested iteration向けscope management
- reusable template function作成用の`with_(context)` helperを追加しました。
- `compile()`が`opts.context`を受け取ってtemplate evaluationできるようにしました。

### Changed

- APIに`transform`、`with_()` exportを追加しました。
- `matra()` unified APIがcontext parameterをsupportしました。

## [0.5.0] - 2025-10-21

### Added

- 複数のoutput formatを追加しました。
  - `toTeX()` - LaTeX output
  - `toESTree()` - ESTree AST（stub）
  - `toCanvas()` - Canvas rendering（stub）
- `evaluate.mjs`と`evaluator.mjs` moduleを追加しました。

## [0.4.0] - 2025-10-20

### Added

- 初期ESM module structureを追加しました。
- Peggy parser integrationを追加しました。
- `toHTML()`、`toJSON()`によるbasic renderingを追加しました。
- Type definitions（`types.mjs`）を追加しました。

## [0.3.0] - 2025-10-19

### Added

- Core parser functionalityを追加しました。
- HAST-compatible AST structureを追加しました。

## [0.2.0] - 2025-10-18

### Added

- Project initializationを行いました。
- Basic package configurationを追加しました。

## [0.1.0] - 2025-10-17

### Added

- Initial repository setupを行いました。
