# Matra 統一文法 v0.3

[English](./unified-grammar.md) | [索引](./README.ja.md)

## 状態と互換性

一般の `.matra` と compiler source の両方を対象とする正式な v0.3 文法仕様である。
本書の規則と共通テストを適合性の基準とする。旧 source の互換性は保証しない。
文法の正式化は、パッケージのリリースや Wasm ABI の安定化を意味しない。
v0.x の破壊的変更として、旧 Core v0.2 の関数ノード構文、selector の `#id`、
backtick／tilde text、`$root`、`= expr`、if/for の暗黙 child 展開を廃止する。
旧 `.matra.program` の入口は削除し、native compiler module も `*.matra` fence に統一する。
`module` 宣言が native profile を選択する。compiler source は `compiler.matra` fence を使う。

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
if = "if", header, block, { "else_if", header, block }, [ "else", block ] ;
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
属性と object entry はソース順に評価し、同じ key は最後の値で上書きする。
class shorthand があれば、重複除去した名前を空白で結合し、明示した class 属性を上書きする。
shorthand がなければ明示した class 属性をそのまま保持する。
通常の関数へ後置 block を渡す構文は v0.3 では受理しない。

ノードの丸括弧内の属性は、カンマに加えて空白・改行でも区切れる。
これは一般の Matra Program の文書 profile を対象とする互換拡張であり、native compiler source は変更しない。
属性値は文字列に限らず従来の完全な式として解析し、次の `属性名 =` が次属性を開始する。
カンマ省略時は次属性名の直前に space/tab/CR/LF が必要で、属性名と `=` の間には
空白・改行・line comment を許す。line comment の後の LF も属性の区切りに使える。
カンマと空白区切りは混在可能だが、末尾カンマは引き続き拒否する。
関数引数・parameter・array・object のカンマは省略できず、markup 属性の規則も変更しない。

```ebnf
node-attributes = attribute, { ( "," | attribute-space ), attribute } ;
attribute = identifier, "=", expression ;
attribute-space = ( " " | tab | CR | LF ), { " " | tab | CR | LF } ;
```

EBNF の whitespace は通常の token 間の trivia と併せて解釈する。
受理例: `img(src="image.png" alt="画像") {}`、
`p(title="Hello " + name lang="ja", count=1 + 2) {}`。
拒否例: `p(a="x"b="y") {}`、`p(a=1 2) {}`、`f(1 2)`、`[1 2]`、`{a: 1 b: 2}`。
空白のない次属性は属性名の開始、値のない属性は次 token または EOF を指す構文エラーとする。
AST・属性の評価順・重複 key の後勝ち・class 優先規則・値モデルは変更しない。
共通 fixtures で受理・拒否・式と属性の境界・実行結果を全 Stage で検証する。

```matra
fn rational(n, d) { {numerator: n, denominator: d} }
let (value = rational(3, 5))
a.link(href="/") { value.numerator }
```

式は literal、reference、array、object、member access、call、node、制御式から成る。
演算子の優先順位は高い順に grouping `(...)`、member access／call、prefix `!`/`-`、`*`/`/`、`+`/`-`、
大小比較 `<`/`<=`/`>`/`>=`、等値比較 `==`/`!=`、`&&`、`||`。
二項演算子は同じ優先順位では左結合する。`&&`/`||` は短絡する。
number literal は符号を含まず、負数は prefix `-` として解析する。

if は選択した block の値を返し、else がなく条件が偽なら null。
`else_if` は直前の `if` / `else_if` に接続し、`else` は連鎖を終了する。
接続の間には空白・改行・line comment だけを許し、別の文や `;` は許さない。
条件は先頭から評価し、最初に成立した body だけを実行する。後続条件は評価しない。
連鎖全体は一つの式で、どの条件も成立せず `else` もなければ null。
`else_if` の header は `if` と同じ括弧・改行・delimiter 規則を使う。
孤立した `else_if` / `else`、`else` 後の追加分岐、空条件や body の欠落は拒否し、
構文エラーは次 token または EOF を指す。
AST は else body に既存の if 式を入れ子にして表し、実行時の判定状態を追加しない。

```matra
let (label = if (score >= 80) {
  "high"
}
else_if (score >= 50) {
  "middle"
}
else {
  "low"
})
```

この拡張は一般の Matra Program と native compiler source の両方を対象とする。
既存の分岐は維持するが、`else_if` を変数・関数・parameter・node tag として使う source は
予約語の追加による v0.x の破壊的変更となる。これらの名前は変更する。
属性・object key・member・class 名では引き続き使用できる。
既存 examples・tests・README での同名 identifier の使用はない。

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

## XML-style markup

一般の Matra Program の文書 profile に、式として XML-style markup を追加する。
既存の `tag(attrs) { ... }`、call、比較・除算は維持する。
`<>` は Matra node の境界を明示するための補助記法であり、XML 互換性より Matra との一貫性を優先する。
native compiler source の文法・ABI は変更しない。

```matra
let image = <img src="image.png" />
<p>Hello <strong>Matra</strong>!</p>
<a.matra-button href="/spec/">Read the spec</a>
```

```ebnf
markup = "<", markup-tag, { ".", markup-class }, { markup-space, markup-attribute }, [ markup-space ],
         ( "/>" | ">", { markup-text | markup }, "</", markup-tag, [ markup-space ], ">" ) ;
markup-attribute = markup-name, [ markup-space ], "=", [ markup-space ], markup-string ;
markup-space = ( " " | tab | CR | LF ), { " " | tab | CR | LF } ;
```

名前、引用符付き `markup-string`、`markup-text` の文字範囲と復号は以下で定義する。

`<tag />` と `<tag></tag>` は同じ空 node を構築する。開始・終了 tag は大文字小文字も含めて
一致しなければならない。markup は既存の node AST に正規化し、runtime に別種の値を追加しない。
`markup-tag` は `[A-Za-z_:][A-Za-z0-9_:-]*`、`markup-class` は `[A-Za-z_][A-Za-z0-9_-]*`、
属性名 `markup-name` は `[A-Za-z_:][A-Za-z0-9_.:-]*` とし、予約語も使用できる。
名前空間の名前と `xmlns` 属性はそのまま保持し、URI 解決は行わない。

開始 tag の `.class` は既存の Matra と同じ class shorthand で、tag と class の間や
`.` の前後に空白・改行・comment は許可しない。終了 tag は class を含めず `</a>` とする。
`<hr.divider />` も受理する。class は最初の出現順を保って重複除去し、空白で連結して
明示した `class` 属性を上書きする。shorthand がなければ明示属性を保持する。
たとえば `<a.button.primary.button class="other">Link</a>` は class が `"button primary"` になる。
AST の `classes` に shorthand を保持し、既存の lowering/runtime を使う。

これは v0.x の破壊的変更である。以前の `<a.b />` は tag `"a.b"` だったが、
今後は tag `"a"`、class `"b"` となる。`<a.b></a.b>` は拒否し、終了名から解釈を推測しない。
literal なドット付き tag 名は markup で表現できず、MatraJSON などを使用する。
属性名のドットは変更しない。完全な XML subset / superset であることは保証しない。
影響範囲は共通 fixtures のドット付き tag、markup parser、README・文書例で、
native compiler source の文法や過去の archive は変更しない。

属性間には space/tab/CR/LF が必要で、`=` の前後にもこれらの空白を許す。値は単一または
二重引用符で囲む string とし、型の推測・式評価は行わない。同名属性は拒否する。
本文は text と子要素の列で、引用符、`{}`、`//`、改行は通常の text である。
空白・改行・字下げは変換せず保持する。連続した text と文字参照は一つの string child にする。
空の text child は作らない。markup 内で Matra 式を補間しない。

本文と属性では `amp`、`lt`、`gt`、`quot`、`apos` の entity と十進・十六進の数値文字参照を
復号する。数値は XML 1.0 の文字範囲（tab/LF/CR、U+0020–D7FF、U+E000–FFFD、
U+10000–10FFFF）に限る。literal の文字にも同じ範囲を適用する。未定義・不完全な参照、
属性内の literal `<`、本文内の `]]>` は拒否する。

コメント、CDATA、処理命令、XML 宣言、DOCTYPE、外部 entity、HTML の補正規則は初期範囲外で、
遭遇した場合は構文エラーにする。`<br>`、boolean 属性、引用符なし属性、終了 tag の省略、
`tag /`、`<tag(attrs) />` は受理しない。`script`/`style` も通常の XML-style 本文として扱う。
隣接する markup 式には既存の文区切りが必要で、`<a /><b />` を暗黙 fragment にはしない。

診断は最初の不正文字・参照の `&`・重複属性名・一致しない終了名の開始位置を指す。
空・不正な class は class 名を期待する位置、終了 tag の `.class` は `.` を指す。
不足 delimiter は次の不正文字または EOF を指す。別の構文への fallback はしない。
共通 fixtures は TypeScript、Rust seed、Stage 1/2/3 の実行結果まで検証する。

## parse と値モデル

文書 profile の `parse()`／`parseUnified()` は source 全体を消費し、宣言と式を保持する
`UnifiedModule` を返す。単一 root node は要求しない。構文エラーで部分的な成功結果を返さない。
`evaluateStatic()`／`evaluateUnified()` は module を受け取り、上記の source の結果を返す。
node 値は `{tag, props, children}` で表し、構文木と評価済みの文書値は区別する。
この正式化では parser、構文木、lowering/runtime、diagnostic の実装変更は不要である。

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

## v0.3 の対象外

文書 profile の module/import 解決、文字列 escape／複数行文字列、型推論、一般の後置 block call、
括弧外の改行継続は v0.3 に含めない。これらの追加は将来の仕様変更として扱う。
安定版 Wasm 値表現は文法とは独立した課題であり、上記 ABI は引き続き experimental とする。
