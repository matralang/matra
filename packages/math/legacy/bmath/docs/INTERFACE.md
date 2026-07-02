# bmathインターフェース

## コマンド・ページインターフェース

bmathは、Matra数式処理を行うためのCLIツールとWebUIを提供します。CLIの標準入力形式はMatra文法です。

### CLI使用方法

#### 基本的な使い方

```bash
npm run cli -- 'Add(1, 2, 3)'
# Output: 6
```

#### オプション

**`--mode`**: 出力形式モード

- `conventional` (デフォルト): 従来的な表記
- `consistent`: 一貫した表記（cdot を使用）

```bash
npm run cli -- 'Times(Integer(value="2"), Symbol(name="x"))' --mode consistent
# Output: 2 \cdot x
```

**`--output`**: 出力形式

- `result` (デフォルト): MathJSONとして解釈し、Compute Engineで評価した結果
- `mathjson`: Matraから変換したMathJSON
- `tex`: TeX形式
- `expr`: Expr表現（数式オブジェクト）
- `formula`: Formula形式（JSON）
- `morphion`: Morphion形式（JSON）

```bash
npm run cli -- 'Add(1, 2, 3)' --output mathjson
# Output: ["Add",1,2,3]

npm run cli -- 'Add(1, 2, 3)'
# Output: 6

npm run cli -- 'Call(Symbol(name="sin"), Symbol(name="x"))' --output expr
# Output: sin(x)

npm run cli -- 'Power(Symbol(name="x"), Integer(value="2"))' --output formula
# Output: 詳細なJSON形式の数式構造
```

**`--input`**: 入力形式

- `matra` (デフォルト): Matra文法
- `tex`: TeX形式（従来形式）

```bash
npm run cli -- "x^2 + 1" --input tex
```

**`--operation`**: Compute Engineの処理

- `evaluate` (デフォルト): 式を評価
- `simplify`: 記号式を簡約
- `numeric`: 数値近似

```bash
npm run cli -- 'Factorial(5)'
# Output: 120

npm run cli -- 'Add(x, x)' --operation simplify
# Output: ["Multiply",2,"x"]

npm run cli -- 'Divide(1, 3)' --operation numeric
# Output: "0.(3)"
```

基本的なMathJSON標準ライブラリの演算をそのままMatra記法で利用できます。

- 算術: `Add`, `Subtract`, `Multiply`, `Divide`, `Power`, `Sqrt`, `Exp`, `Log`, `Abs`, `Factorial`
- 定数: `Pi`, `ExponentialE`, `ImaginaryUnit`
- 三角関数: `Sin`, `Cos`, `Tan` など
- 比較: `Equal`, `NotEqual`, `Less`, `LessEqual`, `Greater`, `GreaterEqual`

#### 使用例

```bash
# TeX式の正規化
npm run cli -- 'Plus(Symbol(name="x"), Integer(value="1"))'

# 累乗式
npm run cli -- 'Plus(Power(Symbol(name="x"), Integer(value="2")), Power(Symbol(name="y"), Integer(value="2")))' --mode consistent

# 分数
npm run cli -- 'Times(Integer(value="1"), Power(Integer(value="2"), Integer(value="-1")))'

# 三角関数
npm run cli -- 'Call(Symbol(name="sin"), Symbol(name="x"))' --output expr

# ヘルプ表示
npm run cli -- --help
```

### Webページ

`examples/index.html`をブラウザで開くと、Web UIでTeX数式を対話的に処理できます。

#### 機能

- **リアルタイム処理**: TeX式を入力して「処理」ボタンをクリック
- **複数の出力形式**: TeX、Expr、Formula、Morphionに切り替え可能
- **モード選択**: Conventional / Consistent モード選択
- **使用例**: よくある数式を1クリックで試用可能
- **Enterキー対応**: Enterキーで即座に処理実行

#### サポートする記法

- **基本演算**: `+`, `-`, `*` (2x), `/`
- **累乗**: `x^2`, `x^{2}`
- **分数**: `\frac{a}{b}`
- **定数**: `\pi`, `e` (E)
- **関数**: `\sin`, `\cos`, `\frac`
- **括弧**: `(...)`, `{...}`

### 処理パイプライン

```plain
TeX入力
  ↓
texToAst() - TeX → Matra AST
  ↓
astToTeX() - AST → TeX出力（正規化）
  ↓
TeX出力

または

TeX入力
  ↓
texToExpr() - TeX → Expr（計算用式）
  ↓
複数の出力形式へ変換
  - toExpression() → Expr文字列表現
  - exprToMatraExprNode() → Matra形式
  - toMorphionForm() → 多項式形式
```

### エラーハンドリング

- 無効な記法はエラーメッセージで報告
- CLIでは失敗時に入力をそのまま返す場合もあります
- WebUIではエラーメッセージを画面に表示
