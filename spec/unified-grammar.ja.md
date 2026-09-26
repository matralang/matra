# Matra 統一文法 v0.3 draft

[English](./unified-grammar.md) | [索引](./README.ja.md)

## 状態と互換性

一般の `.matra` と compiler source の両方を対象とする次期仕様である。
v0.x の破壊的変更として、旧 Core v0.2 の関数ノード構文、selector の `#id`、
backtick／tilde text、`$root`、`= expr`、if/for の暗黙 child 展開を廃止する。
旧 `.matra.program` は互換入口として維持する。compiler source は `compiler.matra` fence を使う。
移行対象は core/seed の parser・評価系・テスト、document.matra、Playground の手続き例、seed README。

TypeScript の `parse()` と Rust seed は統一構文を解析する。`evaluateStatic()` は静的文書を取得し、
`evaluateUnified()` は明示的に実行する。Rust seed と自己ホスト compiler は文書用 Wasm を生成する。
bootstrap の検証では Stage 2/3 の byte equality と、各 Stage の共通文法テストの実行結果を確認する。

## 基本文法と区切り

`let (x = value)`、`if (condition) { ... }`、`while (condition) { ... }`、
`for (item in items) { ... }` を基本形とする。丸括弧の省略形も同じ構文木・意味を持つ。
省略した条件・反復指定では delimiter の内側にない最初の `{` が body を開始する。
その位置に node/object を直接書く場合は丸括弧が必要。省略形は改行継続しない。
括弧の内側では改行・line comment を許可する。call と fn parameter、until の括弧は省略しない。
解析失敗時に別の読み方へ fallback しない。

文は LF または `;` で区切り、閉じ `}` と EOF の直前では区切りを省略できる。
space/tab/CR は文を区切らない。`//` comment は LF または EOF までで、LF は区切りとして残る。
array/object/call の要素間では改行可能。末尾 comma、文字列 escape、改行を含む文字列は拒否する。
不足 delimiter などの構文エラーは次 token または EOF を指す。Rust の位置は UTF-8 byte offset で保持し、
host が行・列に変換する。`else` は対応する `}` の次行に置ける。

```ebnf
source = { statement, ( newline | ";" ) }, [ statement ] ;
statement = expression | let | assignment | function | return | break ;
let = "let", ( "(", binding, ")" | binding ) ;
binding = identifier, "=", expression ;
assignment = identifier, "=", expression ;
function = "fn", identifier, "(", [ identifier, { ",", identifier } ], ")", block ;
return = "return", expression ;
break = "break" ;
block = "{", source, "}" ;
if = "if", header, block, [ "else", block ] ;
while = "while", header, block ;
header = "(", expression, ")" | bare-expression ;
for = "for", ( "(", iteration, ")" | bare-iteration ), block ;
iteration = identifier, "in", expression ;
do-until = "do", block, "until", "(", expression, ")" ;
call = expression, "(", [ expression, { ",", expression } ], ")" ;
node-item = statement | "...", expression ;
```

`if`、`for`、`while`、`do-until` は expression に含む。bare-expression と bare-iteration は
上記の改行・body 開始規則を適用する。node-item は node body の直下だけで使用する。

## 式とノード

任意の関数・constructor は `name(args)` で任意の値を返せる。名前による特例は設けない。
node 構築は body を持つ `tag.classes(attributes) { node-items }` とする。
`=` は属性、`:` は object entry を区切る。class は最初の出現順を保って重複を除去する。
属性名・object key・member 名・class 名では予約語も使用できる（例: `label(for="x") {}`）。
変数・関数・parameter 名では予約語を拒否する。
通常の関数へ後置 block を渡す構文は今回の対象外とする。

```matra
fn rational(n, d) { {numerator: n, denominator: d} }
let (value = rational(3, 5))
a.link(href="/") { value.numerator }
```

式は literal、reference、array、object、member access、call、node、制御式から成る。
演算子の優先順位は高い順に grouping `(...)`、prefix `!`/`-`、`*`/`/`、`+`/`-`、
比較 `==`/`!=`/`<`/`<=`/`>`/`>=`、`&&`、`||`。`&&`/`||` は短絡する。
number literal は符号を含まず、負数は prefix `-` として解析する。

if は選択した block の値を返し、else がなく条件が偽なら null。
for は完了した各反復の block の値を配列にして返す。反復ゼロなら空配列で、break した反復は追加しない。
while/do-until の値は null。block/source の最後が式ならその値、空または最後が宣言・代入なら null。

let は可変 binding を作る。各 block は lexical scope を持ち、同一 scope の重複宣言はエラー、
内側での shadowing は可能。代入は最も近い既存 binding を更新し、未宣言名への代入はエラー。
関数は宣言時の scope を捕捉し、call ごとに parameter scope を作る。
return は最も内側の関数を、break は最も内側の loop を抜ける。関数外の return、loop 外の break は拒否する。

node body は式ごとに child を一つ追加する。宣言・代入は child を追加しない。
`...expression` は配列を一段だけ展開し、配列以外はエラー。通常の配列・object は単一の child として保持する。
null は値モデルに保持し、HTML/SVG renderer は出力しない。

```matra
let (rows = for item in [1, 2] { li { item } })
ul { ...rows }
let label = if (true) { "yes" } else { "no" }
```

受理例: `let x = 1`、`if ready {}`、`for (x in [1, 2]) { x }`。
拒否例: 条件を次行へ続ける `if x +`、`let (x = 1`、`f 1`、node 外の `...items`、
`p { "a" "b" }`、body のない属性指定 `p(href="/")`。
`if ready {}` の ready は変数参照であり、node 構築とは解釈しない。
受理・拒否・境界・実行結果の共通テストは [fixtures/unified.json](./fixtures/unified.json) に置く。

## 静的取得

literal、array、object、先行する static let、それらだけから成る node、静的配列の child 展開を取得できる。
未解決 reference、member、call、operator、制御式、代入は `EvaluationRequired` とする。
静的取得は実行へ fallback しない。

## compiler source の native profile

`module name` は native compiler profile を選択する。一般文書は host value profile を使う。
両 profile の暗黙変換は行わない。native profile は既存の i32/bytes/[i32]/struct pointer ABI を維持する。
compiler source の正本は [compiler.md](../crates/matra-seed/examples/compiler.md) と bootstrap 検証とする。

native profile では `module`、`import`、`struct`、型付き `fn`、`export fn` を追加する。
parameter と戻り値の型は必須で、既存の整数演算・memory intrinsic を使う。
文書 profile と TypeScript evaluator は型注釈と module/import/export/struct を拒否する。
native backend の値は i32 等であり、文書の null/array を使う制御式の値化は対象外。
関数は明示 return を使う。compiler source 自体はこの型付き subset で記述する。

```ebnf
module = "module", identifier ;
import = "import", identifier ;
type = "i32" | "bytes" | "[", "i32", "]" | identifier ;
parameter = identifier, ":", type ;
function = [ "export" ], "fn", identifier, "(", [ parameter, { ",", parameter } ], ")", "->", type, block ;
struct = "struct", identifier, "{", { identifier, ":", "i32", [ newline | ";" ] }, "}" ;
```

compiler artifact は `workspace_pages(sourcePointer, sourceLength)` も export する。host は入力を
配置してから返されたページ数を追加確保し、36-byte result ABI の `compile` を呼ぶ。
文書 frontend の AST arena と emission buffer もこの見積もりに含める。

### 暫定 host value ABI v1

通常の `.matra` の Wasm は `run() -> i32` と `memory` を export する。
`matra` import namespace の helper が string、number、boolean、null、array、object、node を
opaque な i32 handle として管理する。0 は出力なしで、null は独立した値。
関数・分岐・反復・短絡演算は Wasm 内で実行する。host はファイルやネットワークへの capability を与えない。
付属 `host/unified-host.mjs` の `instantiateUnified()` が imports と結果の復元を提供する。
この ABI は experimental であり、native compiler profile の ABI を変更しない。

ABI helper はすべて i32 を受け取り i32 を返す。`literal(pointer, length)` は export memory 上の
UTF-8 JSON を値へ変換し、`scope(parent)`、`bind(scope, name, value)`、`assign(scope, name, value)`、
`get(scope, name)` が binding を管理する。`array()` / `push(array, value)`、`object()` /
`property(object, key, value)`、`member(value, key)`、`node(tag, props, children)` が値を構築・参照する。
`unary(operator, value)`、`binary(operator, left, right)`、`truthy(value)`、`length(array)`、
`item(array, index)`、`spread(array, values)` を提供する。`function(index, scope)` と `call(function, arguments)` は
export table `__functions` の `(scope, arguments) -> value` 関数を呼ぶ。scope handle と value handle は
別の領域である。truthy/length/index は生の i32、それ以外の演算対象は value handle とする。
host の値と scope は instance の寿命まで保持する。長時間の実行向け GC は未実装。
メンバー参照は自身の property のみを許可し、prototype chain は参照しない。

## 保留事項

文書 profile の module/import 解決、文字列 escape／複数行文字列、明示 class 属性と shorthand の結合、
重複属性の統一規則、型推論、一般の後置 block call、括弧外の改行継続、安定版 Wasm 値表現は保留する。
