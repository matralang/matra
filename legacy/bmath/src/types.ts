type MatraNode = { head: string; attributes: Record<string, any>; children: (MatraNode | string)[] }

// 第1層: 一般式
type IntegerExpr = { head: "Integer"; attributes: { value: bigint } }
type RationalExpr = { head: "Rational"; attributes: { num: bigint; den: bigint } }
type GaussianIntegerExpr = { head: "GaussianInteger"; attributes: { re: bigint; im: bigint } }

type Expr =
  | IntegerExpr
  | RationalExpr
  | GaussianIntegerExpr
  | { head: "Complex"; attributes: { re: Expr; im: Expr } }
  | { head: "Symbol"; attributes: { name: string } }
  | { head: "Plus"; attributes: { terms: Expr[] } }
  | { head: "Times"; attributes: { factors: Expr[] } }
  | { head: "Power"; attributes: { base: Expr; exp: Expr } }
  | { head: "Call"; attributes: { fn: string; arg: Expr } };

// 第2層: モーフィオン標準形
type MorphionTerm<Key extends Expr = Expr> = {
  key: Key;
  coeff: Expr;
};

type MorphionForm<Key extends Expr = Expr> = {
  head: "MorphionForm";
  attributes: {
    base: Expr;
    terms: Map<string, MorphionTerm<Key>>;
  };
};

type PolynarionForm = MorphionForm<IntegerExpr>;
type GridarionForm = MorphionForm<GaussianIntegerExpr>;
type GenerionForm = MorphionForm<Expr>;

export type {
  MatraNode,
  IntegerExpr,
  RationalExpr,
  GaussianIntegerExpr,
  Expr,
  MorphionTerm,
  MorphionForm,
  PolynarionForm,
  GridarionForm,
  GenerionForm,
};