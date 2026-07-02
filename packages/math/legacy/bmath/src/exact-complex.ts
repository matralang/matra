import { Expr } from "./types";
import { exprToFraction } from "./exact-expression";
import { absBigInt, exactNthRoot, intOrRatParts, powRationalByInteger } from "./exact-fraction";
import { exactAxisUnitMagnitudePower, exactUnitRootPower } from "./axis-power";
import type { RationalParts } from "./exact-fraction";

type ComplexNumber = { re: number; im: number };

function exactRealRationalPower(baseExpr: Expr, expExpr: Expr): ComplexNumber | null {
  const base = intOrRatParts(baseExpr);
  const exp = exprToFraction(expExpr);
  if (!base || !exp) {
    return null;
  }

  const p = exp.num;
  const q = exp.den;

  if (q <= 0n) {
    return null;
  }

  if (base.num < 0n && (q & 1n) === 0n) {
    return null;
  }

  const rootNumAbs = exactNthRoot(absBigInt(base.num), q);
  const rootDen = exactNthRoot(base.den, q);
  if (rootNumAbs === null || rootDen === null) {
    return null;
  }

  const rootNum = base.num < 0n ? -rootNumAbs : rootNumAbs;
  const rooted: RationalParts = { num: rootNum, den: rootDen };
  const raised = powRationalByInteger(rooted, p);

  return { re: Number(raised.num) / Number(raised.den), im: 0 };
}

function mulComplex(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function invComplex(a: ComplexNumber): ComplexNumber {
  const denom = a.re * a.re + a.im * a.im;
  return {
    re: a.re / denom,
    im: -a.im / denom,
  };
}

function powComplexInteger(base: ComplexNumber, exp: bigint): ComplexNumber {
  if (exp === 0n) {
    return { re: 1, im: 0 };
  }

  let e = exp < 0n ? -exp : exp;
  let b = { re: base.re, im: base.im };
  let result: ComplexNumber = { re: 1, im: 0 };

  while (e > 0n) {
    if ((e & 1n) === 1n) {
      result = mulComplex(result, b);
    }
    b = mulComplex(b, b);
    e >>= 1n;
  }

  if (exp < 0n) {
    return invComplex(result);
  }

  return result;
}

export { exactAxisUnitMagnitudePower, exactRealRationalPower, exactUnitRootPower, powComplexInteger };
export type { ComplexNumber };
