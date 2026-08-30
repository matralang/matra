# Matra bootstrap引き継ぎ

## 目的

Rust seed compilerからMatra製compiler Wasmを生成し、そのcompiler自身で同じsourceを再compileする
bootstrapを成立させる。最終的なself-host判定はstage-2とstage-3のbyte一致とする。

## 現在の到達点

2026-08-31時点の状態は次のとおりである。

| Stage | 生成元 | 状態 |
| --- | --- | --- |
| stage-1 | Rust seed | 生成・実行・byte再現性を検証済み |
| stage-2 | stage-1 | compiler sourceの145行目で停止 |
| stage-3 | stage-2 | stage-2未生成のため未到達 |

`pnpm bootstrap:verify`は実際に各stageを生成し、成功時にはSHA-256を表示する。stage-2とstage-3が生成
できた場合はbyte一致も検証する。現在の結果は次のとおりで、exit codeは`1`である。

```text
Stage 1: ready (<sha256>)
Stage 2: blocked
examples/compiler.md:145:34: parse error: expected integer
   if byte_at(source, value.start + 1) != 111 {
                                                 ^
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
含むlocal struct field access、struct型parameter、conditional左辺とcall argument内のstruct field accessも
compileできる。現在はconditional call argument内のstruct field accessに続く算術を受理しないため停止する。
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

## 次の実装単位

compiler sourceの出現順にconditional call argument内のstruct field accessに続く算術を追加する。
その後は`bytes` returnと複数function call ABI、array、memory組み込みを進める。
stage-2が生成できた時点でstage-3生成とbyte一致が自動的に検証される。

## 次セッションの開始地点

直近の完了commitは`d412030`（`feat(matra-seed): call引数内のstruct field参照を実装`）である。
次に扱うsourceは[`examples/compiler.md`](examples/compiler.md)の次の条件である。

```matra
if byte_at(source, value.start + 1) != 111 {
```

最初に検証する仮説は、call argumentのfield access後に算術operandを読む処理がないため、`+`をcall argumentの
separatorとして扱って停止する、というものである。最小testは
[`tests/wasm.test.mjs`](tests/wasm.test.mjs)の`structConditionalSource`を、たとえば
`read(value.left + 1)`を実行する形へ拡張する。memory上の隣接fieldに異なる値を置き、正しいoffsetの値だけが
返ることを確認するとwriterの誤りも判別できる。

実装では次の3経路でtoken cursorを同じ順序に保つ。

- `parse_local_return_conditional`: field token後にarithmetic operatorと右operandを受理する
- `local_return_conditional_length`: pointer operand、`i32.load`、右operand、arithmetic opcodeの長さを加える
- `write_local_return_conditional`: field load後に右operandとarithmetic opcodeをemitする

body先頭のcall-result conditionalは`parse_conditional_body`、`conditional_body_length`、
`write_conditional_body`から上記local conditional経路へdispatchされる。struct field indexは
`local_struct_field_index`、Wasm operandは`operand_length`と`write_operand`を再利用する。field loadは
`i32.load`（opcode `40`）、alignment immediate `2`、offset `field_index * 4`である。

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

stage-2完成前の`pnpm bootstrap:verify`はexit code `1`が正常であり、停止位置が現在の145行目より後へ進むことを
確認する。各実装単位はtest、lint、bootstrap停止位置、indentationを確認してから独立commitにする。

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
- [ ] conditional call argument内のstruct field accessに続く算術を実装する
- [ ] arrayと組み込みmemory操作を実装する
- [ ] stage-1からstage-2を生成する
- [ ] stage-2からstage-3を生成する
- [ ] stage-2とstage-3のbyte一致を検証する

## 運用上の判断

- 現在の成熟度は`experimental`であり、本番compilerとしてreleaseしない
- generated Wasmとcacheは`target/`またはrelease出力先へ置き、source管理しない
- GitHub Actions artifactは検証用であり、GitHub Releaseへの自動添付はまだ行わない
- self-host成立後もfuzzing、resource limit、ABI version、cross-platform再現性を本番化条件として扱う
