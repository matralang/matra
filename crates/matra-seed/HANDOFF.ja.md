# Matra bootstrap引き継ぎ

## 目的

Rust seed compilerからMatra製compiler Wasmを生成し、そのcompiler自身で同じsourceを再compileする
bootstrapを成立させる。最終的なself-host判定はstage-2とstage-3のbyte一致とする。

## 現在の到達点

2026-09-01時点の状態は次のとおりである。

| Stage | 生成元 | 状態 |
| --- | --- | --- |
| stage-1 | Rust seed | 生成・実行・byte再現性を検証済み |
| stage-2 | stage-1 | compiler sourceの1048行3列で停止 |
| stage-3 | stage-2 | stage-2未生成のため未到達 |

`pnpm bootstrap:verify`は実際に各stageを生成し、成功時にはSHA-256を表示する。stage-2とstage-3が生成
できた場合はbyte一致も検証する。現在の結果は次のとおりで、exit codeは`1`である。

```text
Stage 1: ready (<sha256>)
Stage 2: blocked
examples/compiler.md:1048:3: parse error: expected return
  let after_then = next_token(source, current.start + current.length)
  ^^^
```

stage-1 parserはtop-level `struct` declarationを受理し、literal constructorのfield readをcompileできる。
comparison `if` chain、nested `if`、複数parameter、`bytes` input、struct constructor returnもcompileできる。
local declaration、四則演算、local return、1引数のlocal initializer call、basic `while`とassignment、
loop内local call、call result comparisonと`else`もcompileできる。現在はloop内のlocal comparisonを条件とする
nested `if`と`break`、左辺算術付きcomparison、call argument内の算術、nested `while`、loop local
conditionalの`else`もcompileできる。function bodyではwhile後のconditional、後続local declarationとcall、
call-result conditional、そのbodyのassignmentと`while`、call argument内nested callもcompileできる。
constructor return argument内の算術、local initializer callのliteral argumentを含む複数argument、
functionごとの複数parameter call ABIもcompileできる。local bodyの最終returnにある算術式を
含むlocal struct field access、struct型parameter、conditional左辺とcall argument内のstruct field access、
field accessに続く算術、local initializerのfield access、while右辺のfield accessと算術もcompileできる。
assignment算術式の途中にあるfunction call、conditional右辺のstruct field access、先頭conditional後の
local declaration、先頭conditional列後のinteger literal return、local conditional内nested `if`もcompileできる。
conditional後local declarationに続く`while`もcompileできる。一般 conditionalの左辺call、identifier RHS、
call returnをparseできる。現在はloop conditionalのcall argumentで
field accessに続く算術とcomparison右辺のcall、loop call conditional bodyの`return`、local return conditional
bodyのcall argumentにあるfield accessもcompileできる。現在はconditional後のlocal declaration列を処理したあとに
call initializerを持つ後続local declarationを受理できる。現在はその後のwhileを抜けたあとのlocal declarationで
停止する。
compiler sourceは`bytes` return、array、nested loop body、
`break`、組み込みmemory操作を使用しており、parserとemitterの両方に順次実装する必要がある。

## 検証済みの資産

- Rust seedはMarkdownの`*.matra.program` fenceとimport closureをWasmへcompileする
- bootstrap compilerは任意数の単純function、0または1個の`i32` parameter、literal、parameter return、
  0または1引数のcallをcompileする
- signed / unsigned LEB128と可変長のWasm section、index、export名をemitする
- 36-byte result ABIはstatus、output、diagnostic text、code、UTF-8 source range、expected kindを返す
- Node.js hostはUTF-8 offsetを1-based line / columnへ変換し、source underlineを表示する
- compiler artifactはsource、Rust実装、manifest、lockfile、`rustc -Vv`からcache keyを計算する
- Rust `1.97.1`を[`../../rust-toolchain.toml`](../../rust-toolchain.toml)で固定している
- 独立cacheで生成したstage-1 artifactがbyte単位で一致する
- `v*` tagとmanual dispatchでWasmとchecksumをActions artifactへuploadする

36-byte result recordのlayoutは[`../../spec/program.ja.md`](../../spec/program.ja.md)を正とする。実装の
詳細と利用commandは[`README.ja.md`](README.ja.md)を参照する。

## 再開手順

1. worktreeと直近検証を確認する。

   ```text
   git status --short --branch
   pnpm run test:seed
   pnpm run lint
   ```

2. self-host baselineを実行する。現在はstage-2 blockedによるexit code `1`が期待値である。

   ```text
   pnpm bootstrap:verify
   ```

3. [`examples/compiler.md`](examples/compiler.md)のsource順に、最初のunsupported constructを縦に実装する。
   Rust seed側ではなく、stage-1 compilerのparser、intermediate table、Wasm emitterを一組として更新する。

4. 変更ごとに`tests/wasm.test.mjs`へ小さいProgramの実行testを追加し、`bootstrap:verify`の停止位置が
   前進したことを確認する。

5. 関連testとlintが成功した単位で独立commitする。

## 次の実装判断（2026-09-01）

ここまでのprobeで、assignmentの固定byte数や比較opcodeに確実な不一致は見つからなかった。
一方、parserのbody loopだけをhelper化または制御フロー変更すると、focused testは通ってもstage-2 compileで
OOBとなる。次は同じstatement形について、`parse_loop_conditional`・`loop_conditional_length`・
`write_loop_conditional`の三関数がそれぞれどのsource tokenを消費し、何byteを返すかを表にしてから実装する。

最初の対象は`while x != 0 { if x == 1 { x = 9 } }`のnested local conditionalとする。parserのposition、
lengthの加算、writerのposition更新を1 statementずつ照合し、差分が確定した場合のみ三経路を同じ変更単位で
実装する。差分がない場合は、長いparser関数を分割する前に、stage-2のOOB発生時のWasm functionとbuffer位置を
計測できる診断用の最小変更を追加する。

## 完了した実装単位

top-level `struct` declarationをstage-1 parserへ追加し、literal constructorのfield readをfunction tableの
body kindとして保持する実装を追加した。`pair(20, 22).right`を返す最小Programの実行testが成功し、
`bootstrap:verify`の最初のdiagnosticは3行目の`struct`から26行目の`if`へ進んだ。

parameterとinteger literalのcomparisonを条件とするflat `if` chainと複数の`return`を追加した。6種類の
comparisonを含む最小Programの実行testが成功し、最初のdiagnosticは43行目のnested `if`へ進んだ。

conditional statementのparserとWasm emitterを再帰化し、nested `if`を追加した。内外の条件が成功または失敗
する3経路の実行testが成功し、最初のdiagnosticは67行目の`bytes` parameterへ進んだ。

カンマ区切りの複数parameterと`bytes` inputを追加し、`bytes`をpointerとlengthの2つのWasm `i32` slotへ
loweringした。後続の`i32` parameterを返す実行testが成功し、最初のdiagnosticは同じ67行目のstruct return
typeへ進んだ。

struct return typeとliteral constructor returnを追加した。constructorは1-pageのWasm memoryを持つmoduleを
生成し、fieldを4-byte間隔で格納してpointerを返す。返却pointerから2 fieldを読む実行testが成功し、最初の
diagnosticは68行目のlocal declarationへ進んだ。

`i32` local declaration、parameter/literal/local operandの四則演算、local returnを追加した。
`value * 2 + 2`をlocalへ格納して返す実行testが成功し、最初のdiagnosticは69行目のcall initializerへ進んだ。

1引数のfunction callをlocal initializerとして追加した。`identity(value)`の結果をlocalへ格納して返す実行testが
成功し、最初のdiagnosticは70行目の`while`へ進んだ。

local同士のcomparisonを条件とするbasic `while`と、loop body内のlocal assignmentを追加した。localを5まで
incrementして返す実行testが成功し、最初のdiagnosticは71行目のloop内local call initializerへ進んだ。

loop body内のlocal declarationをWasm local countとindexへ含め、call initializerを追加した。1引数callの
実行testと複数引数callのparseが成功し、最初のdiagnosticは72行目のcall result comparisonへ進んだ。

loop body内でfunction callのresultを比較するconditionalとassignment bodyを追加した。条件の偽・真を通る
実行testが成功し、最初のdiagnosticは74行目の`else`へ進んだ。

loop conditionalの`else`とassignment bodyを追加した。thenとelseの両branchを通る実行testが成功し、最初の
diagnosticは75行目のlocal comparisonを条件とするnested `if`へ進んだ。併せてloop helperのindentationを
block階層どおりに修正した。

loop conditional内のlocal comparisonを再帰的にparse・emitし、nested `if`からloop外へ分岐する`break`を
追加した。nested branchから`br 3`で脱出する実行testが成功し、最初のdiagnosticは76行目の算術付き
comparisonへ進んだ。

local comparisonの左辺に算術式を追加し、local conditional bodyの再帰処理と深さに応じた`break`を追加した。
4階層目のbranchから脱出する実行testが成功し、最初のdiagnosticは77行目のcall argument内算術へ進んだ。

loop conditionalのcall argumentに算術式のparse・length計算・emitを追加した。算術argument付きcallの
実行testが成功し、最初のdiagnosticは79行目のnested `while`へ進んだ。

loop conditional bodyからnested `while`をdispatchし、call conditional bodyの直接`break`とdynamic depthを
追加した。nested whileの実行testが成功し、最初のdiagnosticは88行目のlocal conditional `else`へ進んだ。

loop local conditionalに`else`のparse・length計算・emitを追加した。else付きlocal conditionalの実行testが
成功し、最初のdiagnosticは96行目のwhile後のconditional statementへ進んだ。

function bodyにwhile後のlocal comparisonとearly returnを追加し、struct constructor returnもparse・emit
できるようにした。early returnの実行testが成功し、最初のdiagnosticは100行目のlocal declarationへ進んだ。

conditional後のlocal declarationをparseし、local count/index・length計算・emitへ追加した。early returnを
通らない場合の実行testが成功し、最初のdiagnosticは101行目のcall initializerへ進んだ。

conditional後localのcall initializerをparse・length計算・emitへ追加した。call結果をlocal経由で返す実行testが
成功し、最初のdiagnosticは102行目の後続conditional statementへ進んだ。

local declaration後にもlocal early-return conditionalをdispatchできるようにした。post-local conditionalの
実行testが成功し、最初のdiagnosticは102行目のcall-result conditionalへ進んだ。

local early-return conditionalの左辺にcall resultを追加し、arguments・call・comparisonをparse・emitした。
call-result conditionalの実行testが成功し、最初のdiagnosticは103行目のbody assignmentへ進んだ。

local return conditional bodyでreturn前のassignment列をparse・length計算・emitするようにした。assignment結果を
early returnする実行testが成功し、最初のdiagnosticは104行目のconditional内`while`へ進んだ。

local return conditional bodyから既存のwhile parser・length・writerをdispatchするようにした。conditional内whileの
実行testが成功し、最初のdiagnosticは105行目のnested call argumentへ進んだ。

local return conditionalとloop conditionalのcall argumentに1段nested callを追加した。inner callからouter callへ
値を渡す実行testが成功し、最初のdiagnosticは115行目のconstructor return argument内算術へ進んだ。

local bodyとそのconditional内のconstructor return argumentに算術を追加し、fieldごとのmemory storeをemitした。
local値と減算結果を持つstruct returnの実行testが成功し、最初のdiagnosticは134行目へ進んだ。

initial local initializer callのargument列を反復し、multiple-function moduleのtype sectionをfunctionごとの
parameter slot数から生成するようにした。2引数callの実行testが成功し、最初のdiagnosticは135行目へ進んだ。

local initializer callの返却struct型からfield offsetを解決し、local struct pointerへの`i32.load`と後続算術を
追加した。multiple-function moduleにもstruct constructor bodyとmemoryを追加し、最初のdiagnosticは138行目へ進んだ。

定義済みstruct型をfunction parameterとして許可し、pointerを1つの`i32` slotとして扱うようにした。
struct pointerを受け取って返す実行testが成功し、最初のdiagnosticは139行目へ進んだ。

local-bodyとbody先頭のconditional左辺にstruct field accessを追加し、任意parameterのlowered slot indexから
`i32.load`するようにした。bytes parameter後のstruct fieldを比較する実行testが成功し、diagnosticは142行目へ進んだ。

body先頭のcall-result conditionalをlocal conditional実装へdispatchし、そのcall argument内のstruct field
accessをpointer loadとしてparse・length計算・emitするようにした。field値をcallへ渡す実行testが成功し、
diagnosticは145行目へ進んだ。

conditional call argumentのstruct field access後に算術operandをparse・length計算・emitするようにした。
隣接fieldに異なる値を置いた実行testが成功し、diagnosticは421行目へ進んだ。commitは`915e24d`である。

先頭localとconditional後localのinitializerにstruct field accessを追加し、式終端、local count、variable indexの
cursorもfield tokenへ対応させた。異なるfieldを2つのlocalへ保存する実行testが成功し、diagnosticは422行目へ
進んだ。commitは`5638580`である。

while comparison右辺のstruct field accessと後続算術をparse・length計算・emitするようにした。2つのfieldの
合計までloopする実行testが成功し、diagnosticは423行目へ進んだ。commitは`53613a0`である。

assignment算術式の途中にあるfunction callと、そのcall後に続く算術をparse・length計算・emitするようにした。
loop bodyでcall resultを加減算する実行testが成功し、diagnosticは先頭付近へ進んだ。commitは`9b4e516`である。

conditional比較右辺のstruct field accessをpointer loadとしてparse・length計算・emitするようにした。
field値を右辺に置くcomparisonの実行testが成功した。commitは`f119c1b`である。

function bodyがconditionalで始まる場合もlocal body経路で処理し、後続local declarationをcompileするようにした。
early returnと後続localの両経路を通る実行testを追加し、diagnosticは38行目へ進んだ。commitは`91a93ea`である。

先頭conditional列後の最終returnでinteger literalを受理し、既存の`operand_length`と`write_operand`で
`i32.const`を生成するようにした。複数のearly returnとliteral fallbackの全経路を通る実行testが成功し、
diagnosticは43行目へ進んだ。

local return conditionalのbodyからnested local conditionalを再帰的にparse・length計算・emitし、outer conditionalが
直接returnを持たずに閉じる形を追加した。nested branchの内外を通る実行testが成功し、diagnosticは434行目へ進んだ。

conditional後local declaration列の後から既存のwhile parser・length・writerをdispatchするようにした。early return、
loop 0回、loop複数回の実行testが成功し、diagnosticは435行目へ進んだ。

loop call conditionalのargumentでstruct field accessと後続算術をparse・length計算・emitするようにした。field値と
localを加算したcall結果のcomparisonで真・偽を通る実行testが成功し、diagnosticは435行54列へ進んだ。

loop conditionalのcomparison右辺にfunction callを追加し、field accessと算術を含むargument列を
parse・length計算・emitするようにした。左右のcall結果が等しい場合と異なる場合の実行testが成功し、diagnosticは
436行14列へ進んだ。

loop call conditional bodyでinteger literalまたはidentifierの`return`をparse・length計算・emitするようにした。
loop bodyの条件成立時にearly returnし、不成立時は既存のassignmentを通る実行testが成功し、diagnosticは445行へ進んだ。

local initializer call argumentにfield accessと後続算術を追加し、local countとvariable indexのcursor追跡も
同じcall終端規則へ揃えた。2引数callに`value.start + delta`と`value.length + 1`を渡す実行testが成功し、
diagnosticは447行56列へ進んだ。

local return conditional bodyのreturn call argumentにfield accessと後続算術を追加し、length計算とemitterでも
同じtoken列を処理するようにした。`return function_definition(..., name.start, ...)`を通るself-host検証で
diagnosticは453行3列へ進んだ。

conditional後のlocal declaration列を処理したあと、再び出現する`if`と`let`、後続`while`をlocal body経路で
順に再dispatchできるようにした。`local_count_of`と`variable_index`の追加走査で一時local名が重複しないように
接頭辞を分離した。`let -> if -> let -> if -> let -> return`を通る実行testが成功し、diagnosticは454行25列へ
進んだ。

`while`条件の左辺でfunction call comparisonを受理し、`==`の2個目の`=`、call argument内のfield accessと
後続算術をparse・length計算・emitへ追加した。併せてloop local conditional左辺のfield accessと、
loop conditional / loop local conditional bodyの`return function_call(...)`を受理するようにした。
self-host検証のdiagnosticは468行37列へ進んだ。

local bodyの最終`return function_call(...)`にあるcall argumentで、field accessとその後続算術を
parseできるようにした。続けて一般 conditionalの左辺call、identifier RHS、call returnをparseし、
self-hostのdiagnosticは744行13列へ進んだ。

loop内local conditional（`while <local条件> { if <local条件> { ... } }`のnested if部分）のbodyを、
従来のbreak/return/if 1文限定から、`parse_loop_conditional`と同じbreak/if/while/return/assignment
(let可)の複数statementへ拡張した。`local_count_of`/`variable_index`にもnested if内の新規`let`宣言を
数える走査を追加した。この変更の過程で、`while <local条件> { if <条件> { <assignment 1文> } }`という
形（nested ifのbodyがassignmentまたはlet 1文だけで終わる形）をstage-1でcompileすると、parseは通るが
compile中にWasm `RuntimeError: memory access out of bounds`が発生する既存バグ（今回の変更以前から
存在し、テストされていなかった潜在バグ）を発見した。詳細は`/memories/repo/matra-seed-notes.md`を
参照する。self-host停止位置は744行13列から533行15列へ後退したが、これは複数statement対応で
compiler.mdの構文がより複雑になったことによる現状追認であり、実装の後退ではない。

`parse_while_statement`/`while_statement_length`/`write_while_statement`のbody dispatchに
`is_while_keyword`の分岐を追加し、whileの中にsiblingとして別のwhileが出現するケースを
parse・length計算・emitできるようにした。従来はif/assignmentしか対応しておらず、
while同士が並ぶと後続のwhileの呼び出し名をassignment targetと誤認していた。これが
533行15列の停止の真の原因であり、修正によりself-host停止位置が641行5列へ前進した。

`local_count_of`/`variable_index`/`local_body_length`/`write_local_body`/`parse_local_body`の
5関数が持つ`[lets]*, [optional-while], [ifs]*`固定4段patternに、5段目（while→ifs）と
6段目（lets→while→ifs）を機械的に複製して追加した。`parse_conditional_statement`のbodyが
4段を超える複雑さを持つため、641行5列の`expected return`エラーが発生していた。追加により
self-host停止位置が972行27列へ前進した。

`parse_loop_conditional`のthen bodyにある`break`分岐だけを
`parse_loop_conditional_break`へ切り出した。既存のcursor契約を維持し、focused test 4件、
`pnpm run test:seed`、lintが成功した。helper追加による行番号変更をtest期待値と本書へ反映し、
self-hostの停止位置は`994:27`である。commitは`a42a145`である。

`parse_loop_conditional`のthen bodyからnested `if`とnested `while`のdispatchをそれぞれ
`parse_loop_conditional_if`と`parse_loop_conditional_while`へ切り出した。nested `while`のhelperは
stage-2の直接call return解析を避けるため、local経由で結果を返す。focused test 4件、
`pnpm run test:seed`、check、lint/Markdownlintが成功した。commitは`286ce11`と`014c8ce`である。

続けてelse bodyの`if`、`while`、`break` dispatchを同じhelperへ統一した。statement境界を維持した
まま、focused test 4件と`pnpm run test:seed`が成功した。commitは`0764a78`と`8a445f6`である。

`parse_loop_conditional`の開き波括弧検証を明示的な`else` blockへ包むprobeを行った。この変更で
stage-2の`expected return`は一時的に通過したが、続くcompileで`memory access out of bounds`が
発生したため撤回した。parserのreturn-pathだけを変更する方針は採用せず、Wasm byte数を決める
length/write側との同時修正が必要であることを再確認した。

`loop_local_conditional`の右辺field accessについて、length側がfield load byteを数えず、writer側も
body開始位置をfield後へ進めていない不一致を修正した。`right_end`をlength/writeの共通のbody開始
cursorとして扱い、field loadを両方へ追加した。focused test 4件、`pnpm run test:seed`、check、
lint/Markdownlintが成功したが、self-hostの停止位置は`994:27`のままである。commitは`61bcc71`である。

上記の修正を保護するため、`while`のlocal条件、nested local `if`、RHSのstruct field access、
assignmentを組み合わせた最小回帰testを追加した。seed testはRust 8件とNode 9件が成功し、全checkと
lintも成功した。commitは`15ebf03`である。

同じ方法で`return`分岐をhelper化する試行も行ったが、stage-2がhelper内のreturn pathを
`expected return`として誤判定した。else-chainへ整理しても解消せず、変更は撤回した。次回は
return helperの再試行より先に、stage-2のreturn解析が扱える関数body形を既存の成功例と比較する。

## 次の実装単位

`examples/compiler.md:994:27`は`parse_loop_conditional`関数のbody loop開始位置である。現行の
`parse_loop_conditional`は、then/else bodyそれぞれに`break`、nested conditional、nested
`while`、`return`、assignment/`let`のdispatchを持つ。stage-2 compilerはこのloopの脱出を
十分に推論できず、loop直前の`let current = ...`に対して`expected return`を報告している。

固定段数をさらに複製するのではなく、parser・length計算・Wasm writerのstatement境界を
同時に扱える単位へ分解する。parserだけをassignment helperへ切り出す試行と、parserの
return-pathだけを明示化する試行では、いずれもstage-2が`memory access out of bounds`に
なったため、次は3経路の対応を確認してから進める。

```matra
fn parse_loop_conditional_statement(
  source: bytes,
  offset: i32,
  statement: token
) -> function_definition
```

実装準備:

- 成功値は`function_definition(1, 0, 0, 0, statement_end, 0, 0)`とし、呼び出し側は
  `current = next_token(source, parsed.position)`で次のstatementへ進める。
- `break`は次のtoken、nested `if`/`while`は既存parserの戻り値、`return`は
  `expression_end`、assignment/`let`は`=`後のoperandから`expression_end`までを
  `statement_end`とする。
- nested parserまたはtoken検証が失敗した場合は、既存parserと同じ
  `function_definition(0, 0, 0, 0, offset, error_offset, error_expected)`を返す。
- helper追加後、`parse_loop_conditional`のthen body loopだけをhelper呼び出しへ置き換える。
  else bodyは次の独立した実装単位として、then側の効果を先に確認する。
- `loop_conditional_length`と`write_loop_conditional`は最初のhelper化では変更しない。ただし
  parserだけが先へ進んだ場合は、3関数のstatement境界が一致しているかを最優先で確認する。
  length/writeを変更する場合は同じstatement形を同時に扱い、Wasm OOBを避ける。
- helper自身をstage-1がcompileできない場合は、まず失敗した構文位置と全return pathを確認する。
  その後に必要なら`parse_loop_return_statement`などへ追加分割する。

最初の実装後は、focused testから順に検証する。focused testが失敗した場合は同じparser sliceだけを
修正し、同じtestを再実行してからbootstrapへ進む。

```text
node --test --test-name-pattern='bootstrap compiler maps|call guard before a local and while|multiple statements inside a loop-nested conditional|nested while as a sibling' crates/matra-seed/tests/wasm.test.mjs
pnpm bootstrap:verify
pnpm run test:seed
pnpm run lint
git diff --check
```

`bootstrap:verify`で停止位置が`994:27`より後へ進み、focused test・test・lintが成功したら、
then側helper化を独立commitする。その後にelse側を同じhelperへ置き換え、同じ検証順で記録する。
stage-2が生成できた時点でstage-3生成とbyte一致が自動的に検証される。

## parser return-path probeの結果（2026-09-01）

`parse_loop_conditional`の開き波括弧チェックを`else`へ包むprobeでは、stage-2の停止位置が
`parse_loop_local_conditional`の`expected return`まで進んだ。さらに同関数も同じ形へ包むと、
stage-1は生成できたがstage-2 compile中に`RuntimeError: memory access out of bounds`となった。
parser-onlyの変更はlength/writeとのbyte契約を壊すため、probeはbaselineへ戻した。

then/else bodyのassignment dispatchだけを`parse_loop_conditional_assignment`へ切り出すprobeも実施したが、
`994:27`を越えず、stage-2が先に`compiler.md:478:11`の`expected integer`で停止した。helperの追加と
呼び出し側でのtoken境界変換が、現行stage-2の名前解決または戻り値解析に適合しなかったため、このprobeも
撤回してbaselineへ戻した。次は既存の`parse_loop_conditional_break`/`_if`/`_while` helperと同じ戻り値契約を
利用し、parser・length・writerのstatement dispatchを一度に変更する方針へ切り替える。

その後、assignment helperの`target`/`equals`/`expression_end`を既存のinline処理と同じ形に整理して再試行した。
focused testは成功したが、`pnpm bootstrap:verify`ではstage-2 compile中に`memory access out of bounds`となった。
parserだけがstatement境界を変え、length/writeが従来の境界を使い続けたためである。probeは撤回し、現在の
baselineは`994:27 expected return`である。既存helperの成功パターンはparserを単純に委譲する形に限られるため、
次の実装ではassignmentのtoken解析・length加算・writer出力を同一のstatement形として同時に追加する必要がある。

その後、`write_loop_local_conditional`の比較命令を4 byteへ変更する案を再確認したが、これは誤りだった。
local conditionalの`comparison_opcode`後の`4,64`は`if`とempty block typeで3 byte、`69,13,1`はwhile側の
`i32.eq`・`br_if`・depthで4 byteであり、用途が異なる。lengthの`+4`は比較3 byteと末尾`end` 1 byteに対応するため、
この箇所には修正を加えていない。

stage-2を通過している`parse_local_return_conditional`は、body loop内でnested conditional/whileとassignmentを
直接処理し、return statementを検出した時点でbody loopを終了する構造である。この関数を、loop conditionalの
body parserを分割する際の比較対象とする。単純なassignment helper追加では`expected integer`またはOOBになったため、
次は同じ「loop内でstatementを消費し、終了条件を親関数が保持する」形をparser・length・writerへ同時に適用する。

正常bodyを`if is_symbol(source, open, 123) == 1`で明示的に包むparser-only probeも行ったが、stage-1生成後の
stage-2 compile中に`memory access out of bounds`となった。`else` wrappingと同様に、制御フローだけを変更する
方法ではlength/writeとの契約を保てない。probeは撤回し、baselineの`994:27 expected return`へ戻した。

調査中に提案された`write_loop_local_conditional`の比較命令を3 byteから4 byteへ変更する案は採用しなかった。
同関数のlength初期値`operand_length(left) + 4`は、比較命令3 byteと`end` 1 byteに対応しており、
`while_statement_length`の初期値`12`もheader・条件終端・loop終端の合計として説明できるため、現時点で
確実な不一致とはいえない。次はparser・length・writerのstatement境界を同時に扱うhelper化を、then側の
最小単位から再検討する。

## 次セッションの開始地点

直近の基準commitは`8a445f6`（else側のbreak dispatch helper化）で、作業ツリーはcleanである。
次に扱うのは`examples/compiler.md:994:27`の`parse_loop_conditional`関数内の`expected return`
エラーである。assignment/`let` dispatchを parser・length・writerで同じstatement形として扱える
最小単位を特定する。
詳細な調査ログと仮説は`/memories/repo/matra-seed-notes.md`の
「真の原因判明とnested while実装」「固定段数patternの限界と一般化」セクションを参照する。

主な確認箇所は次のとおりである。

- assignment/`let`のparser・length・writerのstatement境界を突き合わせる
- focused testでstage-1が変更をcompileできることを確認し、`bootstrap:verify`で停止位置を比較する
- parserだけのhelper化でOOBになった場合は変更を戻し、3経路を同時に扱う小さい実装へ分割する
- helper化だけで停止位置が進まない場合に限り、`loop_conditional_length`/`write_loop_conditional`の
  同じstatement形を突き合わせる。固定段数の追加は最後の手段とする

Matraのlocal名はfunction全体で重複できないため、追加する一時名は同じfunction内で一意にする。source編集時は
block階層ごとに2 spaces、tabなしを維持する。機械検査に加えて、変更blockの深さを目視する。

```text
awk 'match($0, /^ +/) && RLENGTH % 2 == 1 { print NR ":" $0; invalid = 1 } END { exit invalid }' crates/matra-seed/examples/compiler.md
! grep -n $'\t' crates/matra-seed/examples/compiler.md
```

最初のfocused testと完了時の検証commandは次のとおりである。terminalでは`rg`を利用できないため、text検索には
`grep`を使う。

```text
node --test --test-name-pattern='bootstrap compiler maps' crates/matra-seed/tests/wasm.test.mjs
pnpm run test:seed
pnpm bootstrap:verify
pnpm run lint
git diff --check
```

stage-2完成前の`pnpm bootstrap:verify`はexit code `1`が正常であり、停止位置が現在の744行13列より後へ進むことを
確認する。各実装単位はtest、lint、bootstrap停止位置、indentationを確認してから独立commitにする。

## 2026-09-01 追加調査

`parse_loop_conditional`の開き波括弧検証とelseなし経路を明示的な`else` blockへ変更し、外側block後に
保険returnを追加した。これによりstage-2は`1048:3`を通過し、`parse_loop_local_conditional`のbody開始
`1384:3`まで前進した。call-condition pathのfocused test 3件は成功した。

`parse_loop_local_conditional`にも同型の変更を試したが、`1387:3`のbody開始で停止したため撤回した。
開き波括弧の正常経路だけを包む簡略版も試したが、`1386:3`の`let current`で停止したため撤回した。
実コード比較では、local側はbody loop後にelse判定を持たず、loop脱出後の単一returnへ直接進む点がcall側と異なる。
そのため、call側のelse包みを機械的に複製するのではなく、local body loopのstatement消費と終了条件を
stage-2が受理できる形へ分割する必要がある。追加probeはOOBを避けるため撤回した。
したがって現行の実装差分はcall-condition parser側だけであり、length/write側は未変更である。次はlocal-condition
parserのreturn-pathを、call-condition側と同じ形にするだけでなく、stage-2が受理できるbody構造へ分解する。

`parse_local_body`の固定段を末尾へ追加するprobeを2種類実施した。`while`後の`let -> if`段を追加した場合、
stage-2の停止位置は一時的に`1048:3`から`1382:3`へ進んだが、次の`while`段を追加しても進展しなかった。
いずれもparserだけの変更であり、length/writeとのbyte契約を揃えていないため撤回した。

この結果から、`1048:3`の直接原因を`parse_local_body`末尾の単純な段数不足と断定しない。次回は
`parse_local_body`が`parse_loop_conditional`をdispatchする直前のtoken列を、`parse_local_return_conditional`の
成功例と比較し、どの固定段で最初に`let after_then`を取りこぼすかを確認する。修正する場合はparser・
`local_count_of`・`variable_index`・`local_body_length`・`write_local_body`を同じstatement列で同時に更新する。

focused loop testはprobe中も成功した。baselineへ戻した後のself-host停止位置は`1048:3 expected return`である。

## Stage-3進捗

- [x] Rust seedから再現可能なstage-1を生成する
- [x] stage-1で単純なfunction、parameter、callをcompileする
- [x] top-level `struct`、literal constructor、field readを実装する
- [x] comparison、flat `if` chain、複数の`return`を実装する
- [x] nested `if`を実装する
- [x] 複数parameterと`bytes` input ABIを実装する
- [x] struct return typeとliteral constructor returnを実装する
- [ ] `bytes` returnと複数function call ABIを実装する
- [x] `i32` local declarationとarithmeticを実装する
- [x] 1引数のlocal initializer callを実装する
- [x] basic `while`とlocal assignmentを実装する
- [x] loop bodyのlocal declarationとcall initializerを実装する
- [x] loop bodyのcall result comparisonを実装する
- [x] loop内conditionalの`else`を実装する
- [x] loop内local comparisonとnested `break`を実装する
- [x] 左辺算術付きcomparisonと深いnested `if`を実装する
- [x] call argument内の算術を実装する
- [x] nested `while` statementとcall conditional内の直接`break`を実装する
- [x] loop local conditionalの`else`を実装する
- [x] while後のconditional statementとearly returnを実装する
- [x] conditional後のlocal declarationを実装する
- [x] conditional後localのcall initializerを実装する
- [x] local declaration後のconditional statementを実装する
- [x] function bodyのcall-result conditionalを実装する
- [x] function-body conditionalのassignmentを実装する
- [x] function-body conditional内の`while`を実装する
- [x] call argument内のnested callを実装する
- [x] constructor return argument内の算術を実装する
- [x] local initializer callの複数argumentとliteral argumentを実装する
- [x] multiple-function moduleの複数parameter call ABIを実装する
- [x] local bodyのlocal struct field accessと最終return算術を実装する
- [x] struct型parameterを実装する
- [x] conditional左辺のstruct field accessを実装する
- [x] conditional call argument内のstruct field accessを実装する
- [x] conditional call argument内のstruct field accessに続く算術を実装する
- [x] local initializerのstruct field accessを実装する
- [x] while右辺のstruct field accessと算術を実装する
- [x] assignment算術式の途中にあるfunction callを実装する
- [x] conditional右辺のstruct field accessを実装する
- [x] 先頭conditional後のlocal declarationを実装する
- [x] 先頭conditional列後のinteger literal returnを実装する
- [x] local conditional内のnested `if`を実装する
- [x] conditional後local declarationに続く`while`を実装する
- [x] loop conditional call argumentのfield accessと算術を実装する
- [x] loop conditionalのcomparison右辺callを実装する
- [x] loop call conditional bodyの`return`を実装する
- [x] local initializer call argumentのfield accessと算術を実装する
- [x] local return conditional bodyのcall argument field accessを実装する
- [x] loop内local conditional bodyの複数statement(break/if/while/return/assignment)を実装する
- [x] while body内でsiblingとして出現するnested whileを実装する
- [x] local body系5関数（local_count_of/variable_index/local_body_length/
      write_local_body/parse_local_body）の固定段数patternに5段目・6段目を追加する
- [ ] arrayと組み込みmemory操作を実装する
- [ ] stage-1からstage-2を生成する
- [ ] stage-2からstage-3を生成する
- [ ] stage-2とstage-3のbyte一致を検証する

## 次の実装準備

### 現在の基準

- branchは`develop`で、作業ツリーはcleanである
- stage-1はRust seedから再現可能に生成できる
- `pnpm bootstrap:verify`の現在の結果は、stage-1 ready、stage-2 blockedである
- stage-2の停止位置は`examples/compiler.md:994:27`、`parse_loop_conditional`のbody loop先頭である
- stage-3はstage-2未生成のため未到達である
- 最小の対象構文は次の形である

```matra
export fn probe(source: bytes, offset: i32) -> i32 {
  let value = offset
  while value != 0 {
    if value == 1 {
      value = 9
    }
  }
  return value
}
```

### 実装前に作る対応表

この対象構文について、次の3経路を1 statementずつ表にする。source cursorは「次に読むtoken」、
Wasm cursorは「次に書くbyte」の位置として記録する。

| 経路 | 対象 | 確認する戻り値・更新 |
| --- | --- | --- |
| parser | `parse_loop_conditional` / `parse_loop_local_conditional` | nested `if`後の`position`と親loopの`current` |
| length | `loop_conditional_length` / `loop_local_conditional_length` | condition、assignment、`end`ごとの加算 |
| writer | `write_loop_conditional` / `write_loop_local_conditional` | comparison、assignment、block終端ごとの`position` |

特に、nested `if`のassignmentが1文で直後に`}`が来る場合に、parserが返す閉じ波括弧の位置と、
length/writeが消費するassignment後の位置を比較する。`let`の有無、RHS field accessの有無を分けて
確認し、1 byteの推測修正は行わない。

### 診断用の最小変更

対応表で不一致が見つからない場合だけ、次の順で診断する。

1. `loop_local_conditional_length`の返却値を一時的に確認できるfocused probeを作る。
2. 同じsourceを`write_loop_local_conditional`へ渡した直後のbuffer位置を確認する。
3. `while_statement_length`と`write_while_statement`について、outer local conditionの前後で同じ値を確認する。
4. 診断用の出力は検証後に削除し、恒久化する変更と混ぜない。

### 追加調査で確定したこと

`pnpm bootstrap:verify`の`994:27`は、`parse_loop_conditional`自身のloop body parserが返した診断ではない。
stage-1がcompiler sourceの`parse_loop_conditional`関数を読む際、`parse_function`から呼ばれた
`parse_local_body`の固定段数が尽き、次のトップレベル`if`をreturn文として扱った結果である。
したがって、local数やcomparison byteを先に変更しても、この停止位置は解消しない。

停止位置から見た不足列は次のとおりである。

```text
if is_symbol(source, open, 123) == 0 { ... }
let current = next_token(...)
while is_symbol(source, current, 125) == 0 { ... }
let after_then = next_token(...)
if is_else_keyword(source, after_then) == 1 { ... }
return function_definition(...)
```

次の実装では、この列を`parse_local_body`へ追加するだけでは不十分である。同じstatement列を
`local_body_length`、`write_local_body`、`local_count_of`、`variable_index`にも追加し、parserが返す
position、lengthが加算するbyte数、writerが更新するpositionを一致させる。特に`let current`は
compiler source上ではcall引数を持つlocal initializerであり、単純な`operand_length`だけでは扱わない。

parser段だけに同列を追加するprobeも実行したが、stage-2の停止位置は`994:27`から前進しなかった。
probeは撤回済みである。この結果から、stage-1が生成するparser bodyのbyte layoutを保ったまま進めるには、
parserだけでなく`local_body_length`と`write_local_body`、local index計算も同じ段で追加する必要がある。

5関数へ同じ`if -> let -> while -> let -> if`列を追加する実装も試したが、stage-2は
`RuntimeError: memory access out of bounds`で失敗したため、変更は撤回した。停止位置を前進させるだけでなく、
`let current`のinitializerについてlengthとwriterのbyte cursorを個別に照合してから再実装する必要がある。

writerの返値ABIを変更せずにlength不足を検出する場合は、`multiple_function_module`のbody予定終端に
一時的なsentinel byteを置き、`write_local_body`実行後にそのbyteが上書きされたかを確認する。予定終端が
上書きされていれば、writerの実出力が`local_body_length`を超えているため、initializerまたは後続statementの
length計算を先に修正する。sentinel probeは診断専用とし、原因確定後に削除する。

このsentinel probeを実装して`pnpm bootstrap:verify`を実行したが、stage-2は依然として
`994:27 expected return`で停止した。parser段階でcompileが終わるためwriterには到達せず、probeからlengthの
過少計算は判定できなかった。probeは撤回済みであり、まずparserの固定段数をlength/writeと整合する形で
追加してstage-2をemitterまで進める必要がある。

### 実装と検証の順序

parser・length・writerの三経路でstatement境界を同時に変更する場合の順序は次のとおりとする。

1. 最小構文のfocused testを追加または既存testを拡張する。
2. 三経路を同じstatement形で変更する。
3. `node --test --test-name-pattern='loop local conditional' crates/matra-seed/tests/wasm.test.mjs`
4. `pnpm run test:seed`
5. `pnpm bootstrap:verify`
6. `pnpm run lint`、Markdownlint、`git diff --check`
7. stage-2の停止位置が前進した場合だけ実装commitを作る。
8. 失敗時は同じ実装単位を撤回し、失敗理由をこの文書へ追記する。

focused testが成功しても、`bootstrap:verify`がOOBになる変更は採用しない。stage-2がreadyになったら、
同じcommandでstage-3生成とstage-2/stage-3のSHA-256 byte一致まで確認する。

## 運用上の判断

- 現在の成熟度は`experimental`であり、本番compilerとしてreleaseしない
- generated Wasmとcacheは`target/`またはrelease出力先へ置き、source管理しない
- GitHub Actions artifactは検証用であり、GitHub Releaseへの自動添付はまだ行わない
- self-host成立後もfuzzing、resource limit、ABI version、cross-platform再現性を本番化条件として扱う
