# Matra bootstrap引き継ぎ

## 2026-09-16 性能改善設計: function metadata sidecar cache

Stage 2の遅延は、`function_at_index()`が毎回source先頭から関数を再走査し、さらに
`function_parameter_count_of`、`function_body_kind_of`、`local_count_of`、length/writeが同じtoken列を
繰り返し解析することが主因候補である。既存の7-field function tableやWasm ABIを直接変更するcache実験は
struct lifetime回帰でinvalid localになったため、次は既存tableと分離したsidecar cacheとして設計する。

### 方針

1. `function_positions(source)`を一度だけ走査し、`[count, position_0, ...]`の`[i32]`を返す。
2. `function_at_index_cached(source, positions, index)`はpositionから`parse_function`を一度だけ呼ぶ。
3. 既存の`function_table`の7-field metadata、temporary flags、bytes/array slot ABIは変更しない。
4. 最初は`multiple_function_module`、`analyze_temporary_functions`、type/code/export section生成など、
  既にfunction indexとtableを持つhot pathだけをcached helperへ置換する。
5. parserやlength/writeの意味、生成Wasm、Stage 2/3 byte equalityが変わらないことを各段階で確認する。

sidecar cacheを`function_positions()`と`function_at_index_cached()`として実装し、
`multiple_function_module`へ限定導入する試行を行ったが、struct lifetime回帰でinvalid localが発生した。
既存table layoutを直接変更していなくても、function position arrayの評価・temporary allocationが
既存のlocal index/arena契約へ影響したため撤回した。次回はcache dataをWasm heapへ置かず、既存の
一時struct ABIと独立した仕組み（またはRust側での解析結果共有）として再設計する。

追加allocationを避けるため、既存function tableの余剰領域へpositionを保存する変形も試したが、
同じstruct lifetime回帰（bootstrap側の連続token testでinvalid local）が発生したため撤回した。

`multiple_function_module`の最初のbody length scanだけを`first_function`から順次parseする実験も行った。
struct lifetime回帰は通過したが、Stage 2の30秒計測ではtimeoutまで短縮せず、効果を確認できなかったため撤回した。

`analyze_temporary_functions`の不動点反復内にある`function_at_index()`も、各反復で`first_function`から
順次parseする実験を行った。struct lifetime回帰6件は通過したが、Stage 2は30秒でtimeoutしたため効果なしと
判断して撤回した。現在のcompiler sourceにはこの実験は残っていない。

診断として`analyze_temporary_functions`自体を一時bypassして`function_table`をそのまま返す試行も行ったが、
Stage 2は同じく30秒でtimeoutした。このため主な遅延はtemporary function不動点解析単体ではなく、
function table構築後のlength/writeやmodule生成経路全体にあると判断し、試行は撤回した。

`compile`の複数function分岐で`multiple_function_module`を一時的に`empty_module`へ置き換える診断も試したが、
Stage 1で`Unknown bytes variable: source`となり、module emitterの実行時間測定まで到達しなかった。
dead branchでもembedded compilerの解析契約を壊すため撤回した。主因の切り分けには使えない結果として記録する。

同様に`compile`内の`function_table(source)`を空の`[i32]`へ置き換える診断も試したが、Stage 1で同じ
`Unknown bytes variable: source`となりruntime測定まで到達しなかった。parser/lowering全体がcompile bodyを
解析するため、単純bypassによるhot path切り分けは成立しない。変更は撤回済み。

その後、ユーザー側の未コミット編集で`analyze_temporary_functions(source, table)`が`record_function`または
`record_call_metadata`内部へ移動していたため、Stage 1で`Unknown bytes variable: source`が発生した。
両record helperを単純更新へ戻し、`function_table`の全metadata構築後に一度だけ解析する元の契約へ復旧した。
現在はStage 1 ready後に通常のStage 2 timeout検知まで進む。

host側で`//`コメントを除去し改行を保持するcompact source modeも一時実装したが、Stage 1で
`Unknown bytes variable: source`となった。現行parser/emitterはコメント除去によるsource offset変化にも依存する
ため、入力圧縮は採用せず撤回した。

### 最適化の責務境界

Rust seed (`src/lib.rs`)の解析共有を改善しても主にStage 1の生成時間しか短縮しない。Stage 2/3で実行される
compilerは`examples/compiler.md`から生成されたWasmなので、Stage 2の長時間問題を解消するにはembedded
compiler自身のparser/metadata設計を変更する必要がある。従って次の性能改善では、Rust側のcacheを先に増やす
のではなく、Matra側で「一度だけ解析した不変metadata」をlength/write/emitterが共有する境界を設計する。
ただし既存のtemporary struct ABIを壊すWasm heap cacheは不採用とし、parser結果をscalar fieldへ展開するか、
既存tableの意味を変えない専用の不変metadata経路を、小さな回帰Programから段階導入する。

### 制約と検証

- sidecar cacheの構築中に`function_definition` pointerを保持しない。各loop iterationでposition scalarだけを保持する。
- cacheをfunction tableへ埋め込まず、既存indexの意味を変えない。
- 初回実装はlookup置換だけとし、local indexやtemporary heapの変更を同時に行わない。
- Stage 1/2/3のStage別秒数を比較し、Stage 2時間が短縮しない、または回帰testが失敗した場合は撤回する。
- 成功条件は`pnpm run test:seed`、`pnpm run lint`、`git diff --check`、Stage 2/3 byte equalityである。

## 2026-09-16 verify-self-host の長時間実行検知

`verify-self-host.mjs`のStage 2/3 compileをWorkerへ隔離し、既定180秒を超えた場合はWorkerをterminateして
`Self-host compile exceeded ... ms and was terminated.`と報告するようにした。通常の成功経路とStage 2/3の
byte equality判定は変更していない。待ち時間を調整する場合は`MATRA_SELF_HOST_TIMEOUT_MS`を設定する。
1秒設定でStage 2 timeoutの検知を確認済みである。

Stage 1/2/3ごとの経過時間も検証ログへ追加した。表示形式は`Stage 2: ready (...; 12.3s)`で、blocked時も
診断末尾にそのStageの経過時間を付ける。これによりmetadata再解析の高速化前後を同じログで比較できる。

標準の`pnpm bootstrap:verify`ではStage 1後にStage 2が180秒でtimeoutした。上限を`600000` msへ延長しても
Stage 1後の無出力が続いたため、10分を待たず停止した。現状は単なる初回build遅延ではなく、Stage 2 compilerの
過剰な再解析または実質的な停止として扱う。タイムアウト機構により端末を手動停止せず検知できる。

## 2026-09-16 追加調査: function metadata field は正常、helper内で上書き

Stage 2 compilerから`function_at_index(source, 3)`の値を個別probeで確認したところ、
function #3 (`next_token`)のmetadataは`name_start = 832`、`position = 2403`で正常だった。
同じ値を`local_count_of`へ渡すprobeも`count = 5`を返したため、巨大な
`invalid local index: 89457`はfunction_at_indexのreturnそのものではない。

`local_body_length`、`write_local_body`、`assignment_length`、`write_assignment`、
`operand_length`、`write_operand`の各入口で`function_definition`を再構築する試行は、
indexを変化させるだけでStage 3を通過せず、最後にcompiler sourceから撤回した。
一時probeも撤回済みである。次回は同じhelper内でtoken scan後に参照しているmetadata fieldを、
一度の処理につきscalarへ退避する設計に限定する。Stage 2/3 byte equality未達、コミット未作成。

追加で`debug_scratch_index(source, 3)`を一時exportして確認したところ、constructor scratchの計算値は
`8`で正常だった。一方、Stage 3 bodyには`local.set/get`のindexとしてStage 2 outputのbytes pointer
（`89457`付近）が出力される。従ってconstructor scratch算術ではなく、expression emitterが
local variableの値とlocal indexを取り違えている経路が残る。debug exportとcaller copy実験は撤回済み。

その後、`function_parameter_close/count`、`returned_parameter_index`、`variable_index`、
`lexical_variable_index`、`fixed_variable_index`、`local_count_of`、`function_reclaims_heap`で
metadata fieldをscalar保存し、name scalar版helperへ分離した。Stage 3の停止値は段階的に変化し、
現在は`function #3 invalid local index: 89814 @+2078`。struct lifetime回帰6件と`cargo check`は成功。
まだbyte equalityには到達していない。残る候補はtop-level function scan/export/body metadata経路で、
token scan後に`function.position`またはname fieldを直接参照する箇所を同じscalar契約へ揃える必要がある。

さらに`let ignored = buffer`のようなbytes variable RHSを`local_slot_width`で2 slotとして数える
`is_bytes_variable`を追加した。Stage 1/2は成功し、struct lifetime回帰6件も成功したが、Stage 3は
`function #3 invalid local index: 89806 @+2078`で停止する。停止値はわずかに変わったためlocal slot
混同の一部には効いているが、bytes pointerがlocal indexへ流れる経路は未解決である。

現時点では、`write_bytes_argument`/`bytes_argument_length`の同一ABI経路で、bytes-return assignmentの
lengthとwriterのcursorが一致せず、後続の`local.set` opcodeがbytes pointerをoperandとして読む可能性が
高い。`is_bytes_variable`自体は一時exportなしで保持し、Rust checkとstruct lifetime回帰6件は成功している。

`bytes_argument_length`と`write_bytes_argument`のindex解決処理は照合上同型だった。`is_bytes_variable`に
よるbytes RHSの2-slot計上はStage 1/2と回帰6件を維持し、停止値を`89814`から`89806`へ変えたが、
Stage 3は依然としてfunction #3のinvalid localで停止する。残る候補はbytes-return assignmentの
`value_expression_length`と`write_value_expression`、またはその後の`write_assignment`のcursor/ABI不一致。

`pnpm run test:seed`はRust 8件を含むNode 30件中29件成功した。唯一の失敗は既存のempty source
self-host assertionで、Stage 3 invalid localにより期待recordを取得できず`null !== 1`になったもの。
bytes slot修正による他のfocused ABI回帰は発生していない。

その後、一時的な`debug_local_body_length`/`debug_local_body_written`を追加してlength/writeを測定し、
`length = 645`、writerのcursor相当値を確認した。probe付きの再生成ではStage 1/2/3がreadyとなり、
Stage 2とStage 3はbyte-identicalになった。ただしprobeは本番ABIではないため、測定後に2 exportを撤回した。
撤回後のself-host再実行はStage 1後に長時間無出力となったため停止し、clean sourceでの再検証は未完了。
probeの残存はなく、`git diff --check`は成功している。

その後の実行ログで、probe撤回後のclean sourceでも次を確認した。

```text
Stage 1: ready
Stage 2: ready
Stage 3: ready
Self-host verification: stage 2 and stage 3 are byte-identical.
```

現在の`compiler.md`にdebug exportは残っていない。`pnpm run test:seed`はRust 8件、Node 30件中29件成功。
唯一の失敗はempty source self-host assertionで、byte equalityそのものではなく現行テストの期待recordが
`null !== 1`になったもの。self-host目的は達成済みだが、未コミット変更は保持している。

## 2026-09-16 最新停止点: function #3 の constructor scratch index

実装途中の `compiler.md` に対する source-scan/probe の試行中、広い patch の文脈誤適用で
Markdown末尾を壊したため、確認済みの clean な `stash@{0}` から `compiler.md` だけを復元した。
Rust seed と追加された `struct-lifetime.test.mjs` は保持している。

検証結果:

```text
cargo check: 成功
git diff --check: 成功
struct lifetime regression: 6 passed
Stage 1: ready
Stage 2: ready
Stage 3: blocked
Generated WebAssembly is invalid: function #3 failed: invalid local index: 89457 @+2047
```

`compiler.md` に残る一時debug exportやsource-scan helperはない。`function #3`は`next_token`であり、
`89457`はconstructor/temporary structのscratch local計算へ、保持中の`function_definition` metadataが
上書きされた値として流入している可能性が高い。次回は広いpatchを避け、`value_operand_length`と
`write_value_operand`の同一constructor 1箇所に限定した回帰と、生成bodyのscratch indexだけを照合する。
Stage 2/3 byte equality未達、コミット未作成。

## 2026-09-16 最新調査: struct temporary の live 値上書き

現在の `node crates/matra-seed/host/verify-self-host.mjs` は引き続き次の状態である。

```text
Stage 1: ready
Stage 2: ready
Stage 3: blocked
parse error: expected return
```

Stage 3 の診断recordを直接読むと、表示上の `1:1` は通常の parser offset ではなく、
`kind = 1`, `offset = 0`, `token length = 6`, `expected = 11` である。Stage 2 compilerの
`token_summary`単独呼び出しは `module` を正しく返すが、次のように複数のtoken structを保持する
probeでは、先に保存したtokenが後続の`next_token()`で上書きされた。

```text
let first = next_token(source, 0)
let second = next_token(source, first.start + first.length)
let third = next_token(source, second.start + second.length)
```

原因はRust seedのtemporary function ABIで、struct戻り値をarena内で再利用する際に、呼び出し元が
保持する複数のstruct pointerを安定して保持できていないこと。struct-return関数をtemporary対象から
外す試行はStage 1実行時の`memory access out of bounds`へ退行したため撤回した。caller側copy、
scratch global、parser probeも検証後に撤回し、現在のsourceには残していない。

連続token probeのpacked resultは、期待される`module(0, 6)`、`compiler(7, 8)`、`struct(17, 6)`ではなく、
先行tokenが後続値へ置き換わった値になった。`restore_heap`のstruct戻り値処理を一時的に書き換えても
この値は変わらず、`next_token`だけをtemporary対象から外すとmemory access out of boundsへ退行した。
従って、単純なheap resetの修正や全struct関数の非temporary化では解決しない。

次に修正すべき所有箇所は`crates/matra-seed/src/lib.rs`の`restore_heap`とstruct-return callの
評価順である。parser側に固定値や例外を追加せず、複数のlive structを保ったままtemporary arenaを
回収できることを、連続`next_token()`の回帰testとStage 2/3 byte equalityで確認する。

2026-09-16時点ではStage 2/3 byte equality未達、コミット未作成。解決できない状態を隠すための
parser workaroundや一時exportは追加していない。

### 追加調査: conflict 復元後の新しい停止点

実装途中の merge conflict marker が残っていたため、marker のない `stash@{0}` の内容へ対象ファイルを
復元した。追加された `tests/struct-lifetime.test.mjs` は保持し、seed/bootstrapとも6件すべて成功した。
復元後のself-hostはparser errorを越え、現在は次で停止する。

```text
Stage 1: ready
Stage 2: ready
Stage 3: blocked
Generated WebAssembly is invalid: function #3 failed: invalid local index: 89683 @+2047
```

function #3は`next_token`で、Stage 3のbodyではlocal宣言が8個なのに、constructor scratch用の
`local.set/get 89683`が出力されている。Stage 2が生成した自身のfunction #3はvalidであり、Stage 2が
sourceを再compileする際の`write_value_operand`のstruct constructor経路で、`local_count_of`または
`function.position`がtemporary struct/tokenの上書きを受けている可能性が高い。

`local_count_of`の終端 scalar退避、`function_definition`の再構築、通常struct-return callのcaller側copyを
順に試したが、前者2つはindexを89683/89461へわずかに変えるだけで未解決、後者は停止点を変えなかったため
撤回した。現時点でRust `cargo check`とstruct lifetime回帰6件は成功している。次はconstructor経路の
scratch local index計算と`write_value_operand`/`value_operand_length`の一致を、function #3だけに限定して
照合する。Stage 2/3 byte equality未達、コミット未作成。

7-fieldの`function_definition`だけをtemporary arena対象から外す限定実験も行った。struct lifetime回帰6件は
通過したが、Stage 1実行時に`memory access out of bounds`へ退行したため撤回した。従って、metadataを
heapへ恒久化するだけではallocation budgetと両立しない。必要なのはcallerが保持するmetadataを明示的に
コピーした後、callee temporary frameを回収するABIである。

## 2026-09-15 現在の停止点: parameter ordinalとWasm slot indexの分離

`function_parameter_is_bytes`は、呼び出し引数の論理ordinal（各source parameterを1つずつ数える）で
判定する必要がある。bytes/[i32]のpointer + lengthによるWasm 2 slot幅をここで加算すると、bytesの後続
parameterを誤判定し、function #86の別のinvalid localにつながる。

一方、`returned_parameter_index`と`function_parameter_count_of`はWasm local slot indexを返すため、
bytes/[i32]を2 slotとして加算する必要がある。この分離で単純な
`fn offset(source: bytes, value: i32) -> i32 { return value }`の生成Wasmとfocused回帰testは通過し、
`offset(100, 5, 42)`も42を返す。

当初はself-hostのStage 2がfunction #134 (`single_function_module`)の
`invalid local index: 4223`で停止していた。logical ordinal方式ではfunction #134、slot幅方式ではfunction #86の
invalid localになることから、`function_parameter_is_bytes`の引数は論理ordinalであることを確認した。
Stage 2/3とbyte equalityは未達。現在はコミット未作成。

### 今回の進捗

`single_function_module`では既存の`result_function` localを再利用し、bytes引数として
誤lowerされるネストした`first_function(source)` callを除去した。これによりfunction #134の
`invalid local index`は解消した。

続いて`byte_pointer(bytes)`をpointer slotへlowerするintrinsicにし、function #139 (`alloc`)の
table外callを解消した。conditional内のbytes returnはpointer + lengthを出すよう修正し、
function #145 (`write_diagnostic_prefix`)のreturn ABI不一致も解消した。

multiple-function module writerは`export`修飾子を持つ全functionを出力するように変更した。
これによりStage 2 compilerから`alloc`、`compile`、`memory`を取得してStage 3の実行まで到達する。
heap globalの初期値も8から32へ変更し、固定address 0で作る一時struct（最大28 bytes）が
`alloc`したsourceの9 byte目を上書きする問題を解消した。

現在の`pnpm bootstrap:verify`はStage 2 validation成功後、Stage 3のsource parserで
`parse error: expected return`に停止する。最小再現の単純return functionはStage 2 parserが受理し、
`if value == 9 { return 1 } return 0`を含むfunctionだけが拒否される。`is_if_keyword`のStage 2 bodyと
単独呼び出しは正しく動作する一方、`parse_conditional_statement`が成功statusとposition 0を返すことを
診断probeで確認した。`function_definition` constructorの式引数を一般式loweringへ変更したが、
conditional parserのposition 0は残っている。次は`parse_conditional_statement`のreturn constructorで
どの式引数が0になっているかを追加probeで特定する。

追加調査では`token_end`が正しいoffsetを返し、単独の`function_definition(..., 70, ...).position`も
70を返す一方、`parse_function`が`is_space`の最初のif終端で止まることを確認した。Rust seed compilerの
temporary-function最適化はstruct戻り値をarena先頭へ戻すため、連続する`next_token()`が前のtokenを
上書きする。struct戻り値をtemporary対象から除外する試行は、parser全体のallocation量と既存のconstructor
loweringの前提に波及してOOBを起こしたため撤回した。次回はtemporary arena内で複数のlive structを保持する
方法、またはRustのstruct constructorを評価順とbase pointer保持の両面で再設計する必要がある。一時exportと
host memory倍率変更は残していない。

## 2026-09-15 解決: function #94のmutation dispatch漏れ

function #94 (`write_i32_leb`)の`invalid local index: 4223`を解消した。
一時的な診断compilerで未解決assignmentのsource offsetを確認すると、対象tokenは
`remaining`や`position`ではなく`byte_set(buffer, position, byte)`の`byte_set`だった。
診断用のindex置換は一時ファイルだけで行い、実装には残していない。

`write_loop_local_conditional`のthen側だけmutation dispatchがなく、
`byte_set`を通常assignmentとして`write_assignment`へ渡していた。
length側とelse側に存在する`is_array_set_call` / `write_mutation`の処理をthen側へ追加した。
local index固定値やparser範囲の拡大は行っていない。

実際の`write_i32_leb`を切り出してStage 1でcompileし、生成Wasmを実行する回帰testを追加。
正負の64/128境界とi32最大・最小値を含む11例について、期待するsigned LEB bytes、
非zero pointer・開始offset、戻り値のpointer/length、範囲外への書き込みなしを確認した。

### 続いて修正した問題

- function #100のmutation引数内callも通常変数として出力されていた。
  mutationのindex/valueを共通のvalue expression length/writeへ統合し、引数の終端も
  `expression_end`へ揃えた。
- function #119では`write_u32_leb`の2 resultに対しlocal.setが1つしかなかった。
  `is_array_return_call`の関数名固定リストを除去し、宣言されたbytes/[i32]戻り値型で判定する。
  EOFを確認するtoken scanであり、parser metadataをsource末尾まで拡張する処理ではない。
- `byte_at`は通常callのparameter型照会より前にlowerする。
  未解決function indexから別関数のbytes parameter型を参照すると、pointerを2 slot出力して
  stackに余分な値が残っていた。pointerとindexの2 operandだけを出力するようにした。
- nested条件、byte/array mutationのcall・算術引数、任意の関数名のbytes-return localを
  一緒に実行する回帰testを追加した。

検証: `pnpm run test:seed`（Rust 8件・Node 23件、focused bootstrap testを含む）、
`pnpm run lint`、`git diff --check`は成功。focused testは約78秒で完了した。

### 残る停止点

function #94の後続問題として、then側のmutation処理漏れを修正した。`write_i32_leb`の
then側で`byte_set`が通常の変数代入として扱われていたため、`local.set -1`が生成されていた。
`is_array_set_call` / `write_mutation`と同じdispatchをthen側へ追加し、実際の`write_i32_leb`
について11例のバイト出力を検証した。

さらに後続で発生したmutation引数内callとbytes戻り値の問題も修正した。現在のStage 2は
function #134 (`single_function_module`)の`invalid local index: 4223`で停止する。
Stage 2/3とbyte equalityは未達。次は#134の実際のlocal参照元を生成Wasmとsource tokenで照合する。

戻り値型の宣言検索は繰り返しsourceを走査するため、self-host検証は従来より時間がかかる。
focused testのtimeoutを30秒から180秒へ延長した。未コミット変更は保持し、コミットは未作成。

## 2026-09-15 解決: array戻り値型のbody開始位置とresult ABI

function #73の`invalid local index: 1535`を解消した。宣言順を再確認した結果、
function #72が`count_functions`、#73は`mark_invalid`だった。以前の対応付けを訂正する。

`function_body_first_token` / `returned_value_token`は戻り値型を1 tokenとして
読み飛ばしていたため、`-> [i32]`でbody開始位置を誤認していた。
`type_end`で型全体の終端へ進めるよう修正した。この修正単独で#73を越えることを確認した。

さらにbytes/array戻り値をlocal body経路へ揃え、単一関数・複数関数moduleのtype sectionにも
pointer + lengthの2 resultを出力した。従来はbody側が2値を積んでも、type sectionは
1 resultのままでpointerが呼び出し元へ戻らなかった。
array_set/byte_setだけを使うmoduleにもmemoryを出力するよう修正した。

回帰testではbytes・[i32]、単一/複数関数、単純return/変更後returnの8組合せを
compile・instantiate・実行し、非zero pointerとlengthの両方、および書き換え結果を確認した。
検証: `pnpm run test:seed`（Rust 8件・Node 21件）、`pnpm run lint`、
`git diff --check`は成功。

### 残る問題

Stage 2はfunction #76 (`function_table`)の`function index #4351 is out of bounds`で停止する。
`allocate_i32_array(capacity)`が通常callとして扱われる経路が残る。
配列確保intrinsic、2 slotを使う配列localの割り当て・保存、配列call resultの転送を
length/writeと合わせて実装する必要がある。未解決indexへのfallbackは追加していない。
Stage 2/3とbyte equalityは未達。未コミット変更を保持し、コミットは作成していない。

## 2026-09-15 追加: allocate_i32_array intrinsicとarray local

`allocate_i32_array(capacity)`が通常callとして出力され、function #76で未解決call indexに
なっていたため、Rust seedと同じ`global.get/set 0`、4倍byte size、pointer + lengthの
2値を`value_operand_length`/`write_value_operand`へ追加した。さらに生成moduleのmemory-required
判定とsingle/multi module writerへmutable global 0を追加した。これにより#76を越え、global
index errorも解消した。

次にarray localのslot不足が判明した。`let table = allocate_i32_array(...)`とarray-return
callをlocal count/offsetで2 slotとして数え、assignment writerでlength slotとpointer slotへ
2回`local.set`する処理を追加した。`array_get(table, index)`もpointer + index * 4 + loadへ
lowerした。

その後、bytes/array returnのcall値を直接localとして扱っていた問題を修正し、`return mark_invalid(table)`を通常のcall + returnとして出力するようにした。さらに`allocate_bytes(size)` intrinsic（heap globalを使うpointer + length）と、bytes localの2-slot計上を追加した。これにより#81/#82のinvalid local、#91の`allocate_bytes` unresolved call、#92のbytes local slot不足を越えた。

現在の停止点:

```text
function #94 failed: invalid local index: 4223
```

function #94は`write_i32_leb`相当のnested loopを含む関数で、raw bodyに`local.set -1`が残る。
通常の`variable_index`、全let lexical scan、既存conditional-aware resolverをassignment/operand
へ併用しても変化しなかった。次はmutation/loop writerが渡すstatement tokenと、nested loop内の
`remaining`/`position`宣言の対応を直接照合する必要がある。Stage 2/3とbyte equalityは未達で、
コミットは作成していない。

## 2026-09-15 追加: function #38のstruct constructor lowering

function #38 (`parse_loop_conditional_if`) の `function index #4351` は、関数名の
lookup失敗ではなく、`function_definition(...)` を通常のfunction callとして出力して
いたことが原因だった。`function_index_in_table` が返す -1 が `10 ff 21` として出力され、
未解決call index 4351になっていた。

`value_operand_length` / `write_value_operand` にstruct constructorの直接loweringを追加し、
各fieldを address 0へstoreした後に `i32.const 0` を残すlength/write対へ統合した。この修正で
function #38の停止は解消したが、Stage 2はfunction #41で次のエラーへ進んだ。

```text
function #41 failed: return_call_ref[0] expected type (ref null 5), found i32.load of type i32
```

focused testは旧停止点を期待しているため現在は失敗する。Stage 2/3とbyte equalityは未達で、
この変更もコミットしていない。次はfunction #41の失敗位置付近で、struct field loadまたは
conditional bodyのlength/write境界を照合する。

その後、`local_struct_field_index` がstruct constructor initializerを通常functionとして
lookupしていたため、`nested.position` のfield offsetが -1 になる経路を修正した。constructor
型を直接 `struct_field_index` へ渡すようにしたことで、function #41の `return_call_ref` 誤読は
解消し、停止はfunction #58 (`count_let_tokens_in_range`) の次へ進んだ。

現在のエラー:

```text
function #58 failed: trailing code after function end
```

`count_let_tokens_in_range` は `let` 2件と `while current.start < end` を含むため、次は
`while_statement_length` と `write_while_statement` の field条件・body終端・break/endの
固定長を、この関数に限定して照合する。focused testの期待値はまだ更新していない。

`while_statement_length` の固定値を一時的に12から10へ変更して検証したが、function #3の
`reached end while decoding immi32`へ早期退行したため、この仮説は否定して12へ戻した。
function #58のbody末尾には正しいreturn/endの後に2 bytesが残ることまでは確認済みである。

その後、`while_statement_length` がstruct field条件の `left` を、field load加算後に
`operand_length(left)`でもう一度数えていたことを修正した。writerとlengthの差分2 bytesが
解消し、function #58の停止は越えた。

続いて function #70 (`call_argument_value_of`) の `read_small_integer(source, argument)`で
bytes parameterのlength slotが欠落していたため、local return conditionalの通常call引数を
`function_parameter_is_bytes`に基づくlength/writeへ統合した。さらに `[i32]` / `bytes` return
の `return table` をpointer + lengthの2 slotで出力する処理を追加した。

現在の停止点:

```text
function #73 failed: invalid local index: 1535
```

生成されたfunction #73のbodyを直接確認すると、bodyは`00 20 ff 0b`相当で、`local.get -1`
（Wasm上ではlocal index 1535）だけを含む。function tableの宣言順との対応から、これは
`count_functions`の`return count`に対応する。したがって、array mutationだけでなく、共通の
local variable index解決、またはfunction body metadataのlength/writeが一致していない可能性が高い。
`mark_invalid`/`record_function`のarray return修正だけではこの停止は解消しなかった。

その後、生成Wasmのtype sectionを照合し、function #73は2引数・1戻り値の`[i32]`系関数である
ことを確認した。bytes/array return時にparameter indexを`returned_parameter_index`から直接
解決する変更も試したが、bodyは引き続き`00 20 ff 0b`のままで停止位置は変わらなかった。
したがって、現時点の主候補はreturn operand単体ではなく、`function_body_kind_of`または
`local_body_length`/writerがこの関数本体をlocal bodyとして認識できていない問題である。

Stage 2/3とbyte equalityは未達で、コミットは作成していない。

## 2026-09-15 解決: function #30の不正なblockとconditional出力

function #30 (`parse_conditional_statement`)の`need 3, got 2`を解消した。
直接原因はconditionalの固定長ではなく、`let open = right_end`のstruct別名に対する
field indexの未解決だった。`local_struct_field_index`はinitializerを関数callとしてのみ
解釈していたため、`open.start`がindex -1、offset -4になっていた。

### 停止位置のbyte照合

修正前のStage 2では、offset 8248から次のbytesが出力されていた。

```text
20 17 28 02 fc 36 02 14
```

意図した命令は`local.get 23; i32.load align=2 offset=4; i32.store align=2 offset=20`。
しかしoffsetの`fc`はLEBの継続bitを持つため、次のstore opcode `36`まで読み込む。
その結果、offset 8254の`02 14`が`block`とtype index 20として解釈され、
block引数不足になっていた。正しい並びは`20 17 28 02 04 36 02 14`。

struct別名をinitializerへ遡って解決するよう修正した。探索範囲は別名宣言より前へ
狭め、自己参照・循環で無限ループしないようにした。parameter由来とcall result由来の
複数段の別名を、nested conditionalのfield参照・実行で検証する回帰testを追加した。
この修正単独で停止点がfunction #38へ進むことを確認した。

### conditionalのlength/write照合と修正

指定された`conditional_statement_length` / `write_conditional_statement`には
別の不一致もあったため、両辺と分岐内代入を共通の式処理へ統合した。

- 旧固定値6は、単純な左辺local.getと右辺i32.constのopcode各1 byteに加え、
  比較1・if 1・空block type 1・end 1を数えていた。一般の式には適用できない。
  現在は左右の式長を個別に加え、固定部分を4 bytesとしている。
- 左辺call出力後の余分な左辺operand出力を除去した。
- 右辺が変数でも先に`i32.const`を出力していた処理を除去した。
- nested conditionalの後はparserのpositionで次のstatementへ進め、各ifにendを1つ出す。
  nested if後の代入も含め、計算長・writer終端・期待する全bytes・buffer外への書き込みなしを
  回帰testで確認した。変数同士の比較、複数byteの即値、左右それぞれのcallも検証する。

検証: `pnpm run test:seed`（Rust 8件・Node 20件、focused bootstrap testを含む）、
`pnpm run lint`（build・workspace check・Markdownlint）、`git diff --check`は成功。

### 残る停止点

`pnpm bootstrap:verify`はStage 1を通過し、Stage 2はfunction #38
(`parse_loop_conditional_if`)の`function index #4351 is out of bounds @+10500`で停止する。
Stage 2/3とbyte equalityは未達。既存の未コミット変更を保持し、コミットは作成していない。

## 2026-09-15 継続: while条件のbytes ABIと右辺call

前回の`read_small_integer`（function #25）における停止を調査し、`while`本体の代入を
`assignment_length` / `write_assignment`へ統合した。`result * 10 + byte_at(source, position) - 48`
のlength/write不一致は解消し、停止はfunction #28（`parse_struct`）へ進んだ。

さらに`while`条件の左辺・右辺callについて、bytes/array parameterを
`bytes_argument_length` / `write_bytes_argument`で2 slot出力する処理を追加した。
右辺が`byte_length(source)`のようなcallの場合に通常operandとして二重出力する経路も除去した。

`byte_length`を通常のfunction table lookupからintrinsic loweringへ切り替えたことで、
function #29（`struct_field_count`）の不正なfunction indexは解消した。現在の
`pnpm bootstrap:verify`はStage 1を通過するが、Stage 2でfunction #30
（`parse_conditional_statement`）の`not enough arguments on the stack for block
(need 3, got 2)`に停止する。conditionalのbytes/array引数経路にも呼び先 parameter
型による2 slot処理を追加したが、この停止点は変わらなかった。次はfunction #30の
local body/conditional lengthとwriterのblock境界を照合する。Stage 2/3とbyte equalityは
未達なので、現時点ではコミットしない。

検証: `pnpm run test:seed`は17件成功・停止地点期待値の更新が必要、`pnpm run build`と
workspace check、`pnpm run lint`、`git diff --check`は成功。修正後のfocused testを再実行する。

## 2026-09-15 解決: conditional callのbytes/array ABI

先頭の未解決事項だった`type_end`の`need 4, got 3`を解消した。
通常callで使う`value_operand_length` / `write_value_operand`を、
local return conditionalの左辺とloop conditionalの両辺でも共有する。
bytes/array parameterのpointer・lengthは既存のslot出力処理を使い、
array変数をbytes専用intrinsicへ渡す処理は追加していない。

- loop conditionalのthen/else内の代入も`assignment_length` / `write_assignment`へ統合。
- local bodyの最終returnは共通return処理へ統合し、bytes/arrayの転送を揃えた。
- 分岐内で宣言したstruct localのfield解決は、関数body全体から宣言を探す。
  従来の先頭の`let`だけを探す処理では`element.start`などのfield indexが未解決になった。
- bytes・array・structの混在、条件式の左右、nested intrinsic、then/else内callを実行する
  回帰testを追加。実際のcompiler sourceから`type_end`を含む部分をcompileし、
  `[i32]`と`i32`の終端tokenを確認するtestも追加した。

検証: `pnpm run test:seed`（Rust 8件・Node 18件）、`pnpm run lint`
（build・workspace check・Markdownlintを含む）、`git diff --check`は成功。

### 残るself-hostの問題

`pnpm bootstrap:verify`はStage 1を通過し、Stage 2の停止箇所は
function #25 (`read_small_integer`)へ進んだ。
`function index #13695 is out of bounds`が発生する。
同関数のwhile内代入には`result * 10 + byte_at(source, position) - 48`があり、
while側に残る独自の式length/write処理の調査が必要。
Stage 2/3の生成とbyte equalityは未達。コミットは行っていない。

## 2026-09-15 追加調査: conditional call ABIは未解決

Stage 2の`function #22 (type_end)`で発生する`need 4, got 3`を追加調査した。
通常callの`value_operand_length` / `write_value_operand`はbytes/array parameterを
2 slotとして扱う既存修正でfocused testを通過するが、self-hostのStage 2ではまだ停止する。

conditionalのcall引数ループにも同じ処理を追加する試行を行った。しかし、bytes/arrayを
一括で`write_bytes_argument`へ渡すとStage 1 compiler自身のコンパイルで
`Unknown bytes variable: table`となる。array引数をbytes引数と同じABI slot数で扱うことと、
bytes専用intrinsic/loweringへ渡すことは分離する必要がある。

今回の試行は未検証のconditional ABI拡張を残さず整理した。現在確認済みの状態は以下。

- focused bootstrap testは成功。
- `git diff --check`は成功。
- `pnpm bootstrap:verify`はStage 1成功、Stage 2で`type_end`の`need 4, got 3`に停止。
- Stage 2/3とbyte equalityは未達のため、コミットしていない。

次の候補は、conditionalの各argumentについて「呼び出し先parameterのslot数」と
「現在関数側argument expressionの実型」を別々に解決するhelperを実装し、
array variableをbytes専用intrinsicへ渡さずpointer/lengthだけを出力すること。

## 2026-09-15 現在の到達点: 通常callのbytes ABI

前節の未コミット変更を保持したまま、通常callのbytes/array引数でpointerだけを
積んでいた経路を調査した。`value_operand_length` / `write_value_operand` の
call引数処理で、bytes/array parameterを2 slot ABIとして扱い、pointerとlengthを
length/writeの両方へ出力する共通処理を追加した。あわせてlocal return conditional
の左辺`byte_at`が通常callとして出力される漏れを修正した。

focused testでは、以前の未解決function indexと「need 3, got 2」が解消した。
全体の`pnpm run test:seed`（Rust 8件・Node 16件）、`pnpm run build`、workspace check、
`pnpm run lint`、`git diff --check`は成功している。

### 現在のblocker

`pnpm bootstrap:verify` は次で停止する。Stage 2/3とbyte一致には未到達である。

```text
Stage 1: ready
Stage 2: blocked
Generated WebAssembly is invalid: WebAssembly.compile(): Compiling function #22
failed: not enough arguments on the stack for call (need 4, got 3) @+4564
```

function #22は`type_end`。`is_symbol(source, value, 91)`のような、bytes parameterと
struct parameterを持つ通常callで、local conditional側のcall引数length/writeが
まだbytesの2 slot ABIへ揃っていない。次は`local_return_conditional_length`と
`write_local_return_conditional`の同じcall引数ループを、struct引数を壊さずに
型別slot数へ統合する。未解決indexのfallback追加や、今回の未検証のsource名固定は
根本修正として扱わない。

Stage 2がvalidになり、focused test、`pnpm run test:seed`、`pnpm run lint`、
`git diff --check`を再確認するまでコミットしない。

## 2026-09-15 修正: loop conditional内の構造体return

この節を現在の到達点とする。開始時の変更は保持している。`next_token`の無効なcallは解消し、
lexer単体の生成Wasmをvalidate・実行できた。ただしself-hostは未成立である。

### 確認した原因

未解決indexの診断用probeを最小lexerへ適用すると、対象tokenは
`return token(1, start, position - start)`の`token`だった。
従来の「nested `byte_at` callが原因」という推定は撤回する。
probeは撤回し、`function_index_in_table`の未解決値は変更していない。

function bodyのcall conditionalはloop conditional経路へdispatchされる。
そのreturn処理は構造体constructorを通常callとして扱い、引数の算術やnested callも
共通の式処理を使用していなかった。

### 修正と検証

- call/localのloop conditionalのthen/elseで`return_statement_length`と
  `write_return_statement`を共有する。constructorは関数のreturn型と比較して判定する。
- return引数は`value_expression_length` / `write_value_expression`で処理し、
  source cursorは`expression_end`へ揃える。
- `loop_conditional_length`の初期値5は通常call opcodeの1 byteを含むため、
  `byte_at`では差分3 bytesを加算する。従来は1 byte過大で、lexer内の2か所により
  `trailing code after function end`も発生していた。
- 実際のlexer sourceをstage-1でcompile・instantiateし、識別子、数字、コメント、
  EOF、記号、offset付き走査を検証する回帰testを追加した。
- call/local conditionalのthen/elseで構造体return、算術、nested intrinsicを実行するtestを追加した。

検証: focused test、`pnpm run test:seed`（Rust 8件・Node 16件）、`pnpm run lint`、
`git diff --check`は成功。`pnpm bootstrap:verify`は下記のABIエラーで失敗する。

構造体returnの格納先は既存emitterと同じaddress 0であり、allocationや複数の生存structの
保持はまだ実装していない。今回の修正をその対応済みとは扱わない。

### 残るblocker

```text
Stage 1: ready
Stage 2: blocked
Generated WebAssembly is invalid: ... function #4 failed:
not enough arguments on the stack for call (need 3, got 2)
```

function #4は`token_summary`で、`next_token(source, 0)`にbytes parameterのlength slotを
転送していない。通常callのbytes/array ABI、struct allocation、global/exportの対応は引き続き必要。
stage-2/stage-3の生成とbyte一致は未到達であり、コミットしない。

## 2026-09-15 引き継ぎ: next_token の nested conditional cursor

この節を現在の到達点とする。未コミット変更は保持しており、stage-2/stage-3 の
self-host と byte equality には未到達である。

### 現在の再現

```text
Stage 1: ready
Stage 2: blocked
Generated WebAssembly is invalid: WebAssembly.compile(): Compiling function #3
failed: function index #2047 is out of bounds @+1668
```

再現コマンド:

```sh
node --test --test-name-pattern='bootstrap compiler maps' crates/matra-seed/tests/wasm.test.mjs
pnpm bootstrap:verify
```

focused test と `git diff --check` は成功する。`pnpm bootstrap:verify` は上記の
invalid Wasm で失敗する。

### 確定した事実

- function #3 は `next_token`。
- `@+1668` 付近の `call 255` は `byte_at` の load opcode ではなく、
  `local.get` の値を引数に取る通常 call である。
- `next_token` 内の `is_identifier(byte_at(source, position))`、
  `is_digit(byte_at(source, position))` が該当する nested call 群である。
- 正しい bytes ABI（pointer と length の2引数）で function table を照会すると、
  `is_space=0`、`is_identifier=1`、`is_digit=2` となり、function table 自体は正常。
- 最小の `while` + nested `if is_identifier(byte_at(...))` source は valid Wasm を生成する。
  従って intrinsic 単体の lowering 漏れではなく、実際の `next_token` にある複数段の
  nested conditional を走査する parser/length/writer の境界ずれが有力。

### 現在のコード状態

- `value_operand_length` / `write_value_operand` と
  `value_expression_length` / `write_value_expression` を導入済み。
- `byte_length` と `byte_at` の複数経路の lowering を追加済み。
- `write_operand` / `operand_length` に `byte_at` の intrinsic 経路を追加済み。
- `local_return_conditional` の nested `byte_at` は length/write を intrinsic に揃えた。
- 手動 token length 走査、function index fallback、debug helper は試行後に撤回済み。
- OOB を起こす手動 loop branch は撤回済み。

### 次に調査する箇所

`parse_loop_conditional`、`loop_conditional_length`、`write_loop_conditional`、
`parse_loop_local_conditional`、`loop_local_conditional_length`、
`write_loop_local_conditional` の nested `if` 処理を、同じ source statement について
1つずつ照合する。特に次を確認する。

- parser が返す `nested.position`
- length が加算する body の終端
- writer が `current = next_token(source, nested.position)` で進める終端
- `else` と nested `while` の後に同じ closing brace を消費しているか

`function_index_in_table` に `-1` の fallback を追加して解決しようとしてはいけない。
一時的に offset が変わっても、length/write の不一致や `trailing code after function end`
を誘発するため、根本原因の修正とは扱わない。

### 未コミット変更とコミット条件

変更ファイルは次の5件。ユーザー変更を戻さず、現状態を基準に作業する。

- `crates/matra-seed/examples/compiler.md`
- `crates/matra-seed/src/lib.rs`
- `crates/matra-seed/host/verify-self-host.mjs`
- `crates/matra-seed/tests/wasm.test.mjs`
- `crates/matra-seed/HANDOFF.ja.md`

stage-2/stage-3 が valid になり、focused test、`pnpm run test:seed`、`pnpm run lint`、
`git diff --check` が通るまでコミットしない。

## 2026-09-14 追加実装: 代入式のintrinsic lowering

この節を最新の到達点とする。開始時の未コミット変更を保持した。
`assignment_length` / `write_assignment`の重複した引数走査を、
`value_operand_length` / `write_value_operand`と
`value_expression_length` / `write_value_expression`へ統合した。
同じ`operand_end` / `expression_end`を使ってnested callと算術の境界を揃える。
`parse_local_body`のcall initializerもnested callの括弧を消費する。

代入式では`byte_length(bytes parameter)`をparameterの長さslotの`local.get`へ、
`byte_at(pointer, index)`を`i32.add; i32.load8_u`へlowerする。
scalar callの引数にあるintrinsic、算術途中のcall、callへの単項minusも扱う。
byte accessを含むmoduleにはmemory sectionとmemory exportを追加する。

追加testはstage-1で生成したWasmをinstantiate・実行し、2つのbytes parameter、
非zero pointer、算術index、128/255のunsigned読み出し、nested scalar call、
再代入、単項minusを検証する。期待値は389と263である。
`byte_length`のlocal bytes・call result対応や、通常callへのbytes複数slot転送は未実装。
今回の共通式処理を接続したのはassignment経路であり、他のcondition/return経路は残る。

self-hostは引き続きstage-2のWasm validationでblockedとなる。
function #3 (`next_token`)の未解決function index #4351は残り、byte offsetは1399となった。
offsetの変化だけを未対応callの解消と判断しない。次はcondition/return側にも共通式処理を
length/writeの対で接続し、通常callのbytes/array ABI、struct allocation、global/exportを整える。
stage-2/stage-3の生成・byte一致には未到達である。

検証: `pnpm run test:seed`、`pnpm run lint`、`git diff --check`。
変更は既存の作業とともに未コミットで保持する。

## 2026-09-14 修正: OOBの解消と生成Wasmの検証

この節を最新の到達点とする。貼付ログの`memory access out of bounds`は解消した。
ただしself-hostは未成立であり、stage-2/stage-3のbyte一致には到達していない。

### 原因と修正

- 4096 pages追加時の停止直後は、allocatorが268,500,994 bytes、memory容量が
  268,500,992 bytesだった。「大容量でもtrapするので容量不足ではない」という過去の判断は撤回する。
- `local_return_conditional_length`/`write_local_return_conditional`はconditional内の`let`を
  assignment targetと誤認していた。function bodyと共有する`assignment_length`/`write_assignment`へ統合した。
- 同じconditionalの`return parameter_count + local_offset`やnested callについて、parserの失敗結果を
  emitterが使い続け、source cursorが進まなくなる経路があった。return算術をlength/writeへ追加し、
  `operand_end`/`expression_end`でnested call、field、unary minus、call後の算術の終端を共通走査する。
  EOFも返すため、閉じ括弧のないcallを無限に走査しない。
- 正常な走査でもtoken/parse resultの一時structは大量に確保される。Rust seedでcall graphを解析し、
  memory更新・明示allocation・pointer取り出しへ到達しない関数だけ、return時に一時領域を回収する。
  scalar returnは全回収、struct returnは返すstructだけ保持する。呼び出し前から存在するstructは
  コピーしない。mutable memory操作やescapeするallocationを含むcall graphは対象外にする。
- OOBで以前は到達していなかった既存testの、引数個数不一致と未知関数の診断位置も修正した。

### 現在の検証結果と次の対象

hostの追加memory設定を増やさず、stage-1の`compile`が結果recordを返すところまで進んだ。
一時的にWasmのexport sectionへ内部関数を公開したprobeで、全関数のbody length走査も確認した。
probeは`/tmp`だけに置き、compiler sourceにはdebug exportを追加していない。

生成されたstage-2相当のbytesは、まだ無効なWasmである。`verify-self-host.mjs`は生成物を
`WebAssembly.compile`で検証してからreadyを表示するよう変更した。現在は次の内容で終了する。

```text
Stage 1: ready
Stage 2: blocked
Generated WebAssembly is invalid: ... function #3 ... function index #4351 is out of bounds ...
```

function #3は`next_token`である。`byte_length`などのintrinsicを通常callとして扱い、
`function_index_in_table`の未解決値-1をcall operandへ流している。次はintrinsicのlowering、
bytes/arrayの複数slot ABI、struct allocation、moduleのglobal/exportを整合させる必要がある。
「recordのstatusが0」「出力bytesを得た」だけではstage-2 readyやself-host成功と判定しない。

回帰testはconditional内のdeclaration/call initializer/return算術を実行し、両分岐で13と5を確認する。
arenaのtestでは2万回のscalar呼び出し、再帰からのstruct return、既存structの保持、
外部へ返したallocationとmutationを検証する。既存self-host testはWasm validationによるblockedを
期待するものであり、self-host成功のtestにはしていない。

検証: `pnpm run test:seed`（Rust 8件・Node 13件）、`pnpm run lint`、`git diff --check`。
変更は未コミット。

## 2026-09-14 修正: function bodyの再代入を共通処理へ統合

貼付された調査ログに対応する未コミット変更から再開し、`3726:3 expected return`を再現した。
この節を最新の到達点とする。開始時点の変更（array型、mutationの読み飛ばし、LEB writerなど）は保持している。

`parse_local_body`に局所追加されていた前後2組のassignment走査を削除し、
`is_local_assignment`で`let`とidentifierへの再代入を判別する形へ変更した。
parser・`local_body_length`・`write_local_body`は同じ判別を使い、既存のinitializer処理と
`variable_index`による格納を再利用する。関数本体の先頭判定も同じhelperへ揃え、
parameterへの再代入から始まるfunctionを受理する。単項minusのoperandも検証する。
`return`は先読み前に除外し、終了判定と不要なtoken allocationの両方を保つ。

回帰testはfunction先頭のparameter再代入、while後のcall assignmentと単項minus、
conditional後の算術assignmentを含む12回のstatement列をstage-1でcompile・実行する。
then/elseそれぞれの実行結果は58と70。既存のreturn欠落や不正tokenのtestも維持した。

現在のself-host結果は次のとおり。元のassignment停止は解消したが、stage-2は未生成である。

```text
Stage 1: ready (97ae1048937c1181b87130c78c834d584ea4f8df483eec2ab63569a3359e012e)
Stage 2: blocked
examples/compiler.md:3763:15: parse error: expected integer
      byte_set(buffer, position, 33)
```

次はnested conditionalのelse側を含むmutation statementの対応が必要になる。
開始時点の変更には`byte_set`/`array_set`を`expression_end`で読み飛ばす経路があるが、
対応するlength加算やstore命令の出力がない。parserだけで次へ進めても、生成compilerが
bufferやfunction tableを更新できないため、これを実装済みのmutation対応として扱わない。
then/elseのparser・length・writerを揃え、生成Wasmが実際にmemoryを更新するtestが必要である。

検証済み: `pnpm run test:seed`（Rust 8件・Node 11件）、`pnpm run lint`、`git diff --check`。
bootstrap failure assertionは現在の停止対象へ更新した。self-hostの成功を示すtestにはしていない。
stage-3およびstage-2/stage-3 byte一致は未到達。今回の変更は未コミットである。

## 2026-09-14 追加修正: nested call と while field access

`compile_diagnostic(1, byte_length(source), 3)` を越えるため、parser の return call / local body
constructor 引数で nested call の括弧を走査し、`local_body_length` と `write_local_body` でも
通常 function call と struct constructor を分離した。`while current.start < end` のような条件に
対応するため、`parse_while_statement`、`while_statement_length`、`write_while_statement` の
左辺 field access も揃えた。self-host 検証時の memory OOB は作業領域不足だったため、
`verify-self-host.mjs` の確保量を増やした。

現在の fresh stage-2 停止地点は次のとおり。

```text
Stage 1: ready
Stage 2: blocked
compiler.md:2655:58: parse error: expected identifier
return function_parameter_count_of(source, function) + local_offset
```

`pnpm run test:seed`（Rust 8件・Node 11件）と `pnpm run lint` は成功している。
stage-3 の生成と stage-2/stage-3 byte 一致は未検証。次は return call の引数 token 走査と
`parse_function` / `parse_local_body` の function parameter 列処理を、生成 Wasm の cursor
不一致を起こさない形で整理する。

## 2026-09-14 修正: unary minus の parser/length/writer を統一

`return_value = -return_value` を含む local-return conditional の assignment について、
parser が `-` の次の operand を検証して `expression_end` まで進むようにした。
length/write は共通の `operand_length`、`write_operand` を使い、`-x` を
`i32.const 0; x; i32.sub` へ lower する。local body の通常 RHS cursor は既存の
field/call 処理を壊さないよう維持し、unary RHS だけ次 operand 直後へ進める。

この修正で `pnpm bootstrap:verify` は unary 停止を越え、次の nested call まで進んだ。
現在の停止は次のとおり。

```text
Stage 1: ready
Stage 2: blocked
examples/compiler.md:2220:43: parse error: expected integer
  return compile_diagnostic(1, byte_length(source), 3)
```

`compile_diagnostic` は struct constructor であり、第2引数の `byte_length(source)` を
constructor argument の length/write がまだ通常 operand として扱っている。nested call 対応を
追加する probe は Wasm memory OOB と既存回帰を起こしたため撤回した。次はこの constructor
argument の nested call を、既存の call assignment 実装と同じ byte 列・source cursor 契約で
最小変更として実装する。

検証済み: Rust 8件、Node 10件、`pnpm run lint`、`git diff --check`。

## 2026-09-14 修正: function bodyの固定段数を撤廃

この節を最新の到達点とする。以下の過去ログにある`2140:37 expected }`は解消した。
`parse_local_body`、`local_body_length`、`write_local_body`の固定continuation列を削除し、
`let`・`while`・`if`の列を最終`return`まで反復して処理する形へ揃えた。
local declarationの格納先は連番の加算ではなく`variable_index`で求める。これにより、
先行するconditional/while内のlocal declarationも含むfunction全体のindexと一致する。
parserは処理できるstatementがない場合に`expected return`を返し、EOFや閉じ波括弧で停止する。

回帰testは`let -> while -> if`を12回繰り返し、nested local、then/elseのassignment、
後続localとreturnを含むProgramをstage-1でcompileして実行する。
修正前は6回目の`let value5 = identity(5)`で`expected }`となり、修正後は両分岐で期待値を返す。
return欠落、EOF、予期しないtokenもtimeout付きで検証する。
このtestには繰り返すtoken走査のallocation用に64 pagesを追加している。
既存の多数のcompileを同一instanceで行うtestも、累積allocationに合わせて追加memoryを8から16 pagesへ増やした。
hostのmemory見積もりやallocator自体は変更しておらず、大きなProgramのmemory管理は別の課題として残る。

現在の`pnpm bootstrap:verify`は次の結果であり、self-hostはまだ成立していない。
固定列の削除で行番号が減ったが、停止対象は従来の`parse_local_body`より後の`parse_function`へ進んでいる。

```text
Stage 1: ready (347fc0d0d74cc6ef7cab7837a4253a4e9c3fec30192161ca32826137dd2e9dfa)
Stage 2: blocked
examples/compiler.md:2018:22: parse error: expected integer
      return_value = -return_value
```

検証は`pnpm run test:seed`（Rust 8件・Node 11件）、`pnpm run lint`、
`git diff --check`を実行した。

次はassignmentの単項minusをparser・length・writerで一組として扱う。
診断用に`0 - return_value`へ書き換えると、その先の
`return compile_diagnostic(1, byte_length(source), 3)`のnested callまで進んだが、
この書き換えは撤回し、元の単項minusを保持した。
stage-2/stage-3生成とbyte一致は引き続き未検証である。

## 2026-09-14 追加調査: second continuation の dispatch probe

`parse_local_body` の `second_continuation` 段について、parser・`local_body_length`・
`write_local_body` の field comparison dispatch を一時的に同じ判定へ揃えた。
parser の既存判定は `operator == '.'` の場合に右辺と本体先頭を確認し、一般 conditional と
local-return conditional を選ぶ。一方、length/write 側の同じ段は dot 形式でも常に
local-return conditional へ送っていたため、source cursor の不一致候補として検証した。

検証結果は次のとおり。

- ローカル変数名の重複と引数契約を修正すると Stage 1 は生成できた
- Stage 2 は従来どおり `compiler.md:2140:37 expected }` で停止した
- `pnpm run test:seed` は Rust 8件・Node 10件すべて成功した
- 停止位置が変わらなかったため、probe は撤回し作業ツリーを clean に戻した

従って、現在の blocker は `second_continuation` の top-level dispatch だけではない。次は
`parse_loop_conditional_if`、`loop_local_conditional_length`、`write_loop_local_conditional` の
nested conditional body と `else` 後の token 消費を1 statement単位で照合する。特に
field comparison の nested `if` が `parse_loop_local_conditional` へ送られた後、parser が返す
`position`、length が加算する終端 byte、writer が更新する終端 byte が同じ closing braceを
指すかを確認する。固定段数の追加や parser 単独の変更は、今回の結果から採用しない。

## 目的

Rust seed compilerからMatra製compiler Wasmを生成し、そのcompiler自身で同じsourceを再compileする
bootstrapを成立させる。最終的なself-host判定はstage-2とstage-3のbyte一致とする。

## 2026-09-14 追加調査: `parse_local_body` の固定段停止

直近の基準commit `006accd` で作業ツリーはclean。`pnpm bootstrap:verify`の実測結果は次のとおり。

```text
Stage 1: ready
Stage 2: blocked
examples/compiler.md:2140:37: parse error: expected }
  if is_if_keyword(source, current) == 1 {
```

`parse_local_body`の`second_continuation_while`直後にある単発`if`へ、条件不成立時の
`else { current = current }`を追加するprobeを行ったが、停止位置は変わらなかったため撤回した。
直前の`second_continuation_while`自身にある同型のno-op `else`を除くprobeは、停止位置を`2137:37`へ
後退させたため撤回した。従って、このno-op `else`の有無だけでは原因を解消できない。

parserは同じcontinuation列をlength/write側より細かい固定段で処理している。特にparserには
`second_continuation_while`後の単発conditionalがある一方、length/write側も同じstatementを処理するが、
制御フローと失敗経路の形が一致していない。parserだけを変更すると過去のprobeと同様に、stage-2の
停止位置を進めてもlength/writeのbyte cursorがずれてWasm OOBになる可能性が高い。次回はこの段を
parser・`local_body_length`・`write_local_body`・local数/index走査の同時変更単位として、最小の
`while -> if -> let -> return`列で対応表を作る。固定段数の機械的な追加やparserだけの反復化は採用しない。

今回の復元後に`cargo test --manifest-path crates/matra-seed/Cargo.toml`と
`node --test crates/matra-seed/tests/*.test.mjs`を実行し、Rust 8件・Node 10件が成功した。

## 2026-09-14 代入の出力不整合を修正

`loop_conditional_length`、`loop_local_conditional_length`、`write_loop_conditional`、
`write_loop_local_conditional`のthen/else代入を、既存のwhile内代入と同じ処理へ揃えた。
call argumentのfield access、算術、複数argument、call opcode、localへの格納と次tokenの更新を含む。
parserの`expression_end`は変更していない。

`wasm.test.mjs`にstage-1経由でcompile・実行する回帰testを追加した。local条件とcall条件それぞれについて、
then/elseのcall assignment、thenのearly returnとelseのcall assignmentを検証する。
修正前は`invalid local index: 4351`でWasmのinstantiateに失敗し、修正後は全経路で期待値を返した。

ただし、self-hostは未成立である。`bootstrap:verify`は引き続きstage-2の`2140:37 expected }`で停止する。
診断用にparserをexportして確認したところ、対象の外側call conditionalと内側field conditionalは単体では
closing braceまで正常に解析できた。一方、`parse_local_body`の最終return処理直前の`current`は、
returnではなく問題の`if is_if_keyword(...)`を指していた。従って、この停止は代入のwriterだけでは解消せず、
親function bodyの固定statement列を一般化する必要がある。

末尾conditionalをparser/length/writerで反復するprobeは`2248:40`まで進んだが、追加したwhile自身で停止した。
根本解決にならず、一般conditionalとlocal-return conditionalの契約も未統一のため、このprobeは撤回した。
次はparser・length・writerのfunction bodyを同じstatement列として扱い、最終return前のtokenも検証する。
診断用exportや一時returnはsourceに残していない。

## 2026-09-02 現在の状態

直近の実測では、stage-1は生成できるが、stage-2は次の位置で停止している。

```text
Stage 1: ready (<sha256>)
Stage 2: blocked
examples/compiler.md:2140:37: parse error: expected }
  if is_if_keyword(source, current) == 1 {
                                    ^
```

`parse_local_body`の末尾でreturn以外を一律に`expected return`としていた経路を、
`parse_conditional_statement`へ渡してから既存のreturn処理へ戻すよう変更した。これにより、
conditional自身のclosing braceはconditional parserが消費し、親functionのclosing braceは既存の
return処理へ返る。`658:5`の停止は解消した。

`2140:37`のsingleton `if is_if_keyword(...)`を後段と同じ`while`へ置換するprobeは、
focused test 3件を通過したが、stage-2の停止は同じ行の`2140:40 expected }`となっただけであった。
このため採用せず撤回した。outer statementを`while`へ変えるだけでは、そのbodyのnested conditionalを
stage-2が消費できない。

現行の`local_count_of`と`variable_index`は`third_post_conditional_if`で固定走査を終了する一方、
`parse_local_body`、`local_body_length`、`write_local_body`はその後のcontinuation段まで持つ。
既存の`count_let_tokens_in_range`と`let_offset_in_range`はfunction body全域をtoken単位で走査できるため、
`local_count_of`と`variable_index`をこの2 helperへ一般化した。旧実装は比較用に`fixed_*`として残し、
呼び出し先を一般化している。stage-1生成とfocused testは成功し、固定段数の同期対象を3経路まで
減らした。stage-2のparser停止位置は変わらないため、次はparser・length・writerを同じstatement列で扱う。

second continuationのconditionalはparserでは単発`if`だが、lengthとwriterが`while`で後続の
`if is_let_keyword(...)`段まで同じconditional列として消費し得た。lengthとwriterを単発`if`へ揃え、
parser・local数・index・length・writerの消費範囲を一致させた。stage-1生成と全test/lintは成功した。
stage-2の停止位置は`2140:37`のままであり、残る課題はparserがこの位置に到達することではなく、
生成済みstage-2が同位置のconditionalを受理するためのstatement段を持たないことである。

続くthird continuation local declarationもparserは単発`if`だが、lengthとwriterは`while`だった。
同じく単発`if`へ揃え、次段の`while`とterminal conditionalを過剰消費しないようにした。stage-1生成、
全test、lintは成功し、stage-2の停止位置は変わらない。

third continuation後のconditional列もparserはterminal conditionalを1件だけ処理するが、lengthとwriterは
複数のlocal return conditionalとして処理していた。lengthとwriterを単発`if`へ揃え、terminal returnを
conditional列へ誤って含めないようにした。stage-1生成は成功し、stage-2停止位置は変わらない。

現在の停止は、同じ`parse_local_body`の前方にある`while is_if_keyword(...)`段をstage-2が読む際の
`expected }`である。次はこのwhileのbodyを読むparserと、対応するlength計算・writerが同じbraceを
消費しているかを、最小の診断用Programで確認する。

その後、`parse_local_body`のwhile後conditional列でcall conditionalを`parse_loop_conditional`へ
dispatchする修正を追加した。停止位置は`2124:37`から`2137:37`へ前進した。続けて`second_continuation_while`の
status分岐と外側`while`分岐を明示的な`else`へ整理し、停止位置は`2140:37`へ前進した。stage-2はまだ同じ
conditional列のclosing brace境界で停止している。対応するlength/write側の同一段も確認が必要である。

## 2026-09-03 追加切り分け

`2140`の外側conditionalの本体を段階的に復元して確認した。次のlocal initializer、nested conditional、
外側`else`まではstage-2が次の`while is_if_keyword(...)`へ進む。最後の
`if second_continuation_if.status == 0 { ... } else { ... }`を加えた時点で、停止位置は再び
`2140:37 expected }`へ戻る。return文の有無ではなく、このfield comparison conditionalの`else`が
再現条件である。

このnested conditionalは`parse_loop_conditional_if`から`parse_loop_local_conditional`へdispatchされる。
`parse_loop_local_conditional`のbodyを波括弧深さだけで走査するprobeでは`2140`を通過したが、生成された
stage-2 compilerはsourceの`91:14`で`expected integer`となった。nested conditionalのdispatchを
`parse_local_return_conditional`へ変えるprobeも`2140`を通過したが、stage-2 compilerはsourceの`76:25`で
`expected {`となった。いずれもstage-1は生成できる一方、stage-2 artifactのtoken cursorまたはWasm byte
cursorが不整合になるため撤回した。

この結果、`parse_loop_local_conditional`またはdispatchだけを変える実装は採用できない。次の実装単位では、
次の三経路を同じconditional body/elseのtoken列で同時に扱う必要がある。

| 経路 | 対象 |
| --- | --- |
| parser | `parse_loop_local_conditional`と`parse_loop_conditional_if` |
| length | `loop_local_conditional_length`と親`loop_conditional_length` |
| writer | `write_loop_local_conditional`と親`write_loop_conditional` |

その際は、`then`のreturnと`else`のcall assignmentを含む最小Programを追加し、各経路が返すsource positionと
Wasm byte positionを照合する。parserだけの変更や、body scannerの置換を先に恒久化しない。作業ツリーはcleanで、
基準の`pnpm bootstrap:verify`は引き続き`2140:37`で停止する。

同三経路を照合した結果、具体的な不一致も確定した。`parse_loop_local_conditional`のassignmentは
`expression_end`を用いるため、`current = next_token(source, second_continuation_if.position)`のcall全体を
消費する。一方、`loop_local_conditional_length`と`write_loop_local_conditional`のassignmentはRHSの先頭token
だけを扱い、直後の`(`を次statementとして処理する。これによりelse bodyのsource cursorとWasm byte cursorが
ずれる。実装ではthen/elseの両方について、既存の`while_statement_length`と`write_while_statement`にある
call assignment処理（argument、field access、算術、call opcode、終端tokenの更新）を同じ形で移植すること。
親の`loop_conditional_length`と`write_loop_conditional`にも同じ欠落があるため、同一commitで4関数を揃える。

## 現在の到達点

2026-09-01時点の状態は次のとおりである。

| Stage | 生成元 | 状態 |
| --- | --- | --- |
| stage-1 | Rust seed | 生成・実行・byte再現性を検証済み |
| stage-2 | stage-1 | compiler sourceの1499行1列で停止 |
| stage-3 | stage-2 | stage-2未生成のため未到達 |

`pnpm bootstrap:verify`は実際に各stageを生成し、成功時にはSHA-256を表示する。stage-2とstage-3が生成
できた場合はbyte一致も検証する。現在の結果は次のとおりで、exit codeは`1`である。

```text
Stage 1: ready (<sha256>)
Stage 2: blocked
examples/compiler.md:1499:1: parse error: expected return
}
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

ここまでのprobeで、assignmentの固定byte数や比較opcodeに確実な不一致は見つからなかった。`parse_loop_local_conditional`の
`open`成功側とbody後の通常経路を既存の`parse_loop_conditional`と同じ`else`構造へ整理した後、local bodyの`break`、nested `if`、
`while` dispatchも既存helperへ統一した。その結果、stage-2の停止位置は`1387:3`から`1381:3`へ移った。
さらに`parse_while_statement`のopen判定成功側を`else`へ包み、stage-2の停止位置は`1499:1`へ前進した。
現在は同関数の終端で停止しており、focused testと`bootstrap:verify`で同じ位置を再現できた。
一方、parserのbody loopだけをhelper化または制御フロー変更すると、focused testは通ってもstage-2 compileで
OOBとなる。次は同じstatement形について、`parse_loop_conditional`・`loop_conditional_length`・
`write_loop_conditional`の三関数がそれぞれどのsource tokenを消費し、何byteを返すかを表にしてから実装する。

今回の次の対象は`parse_while_statement`の終端return経路とする。parserのposition、
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
