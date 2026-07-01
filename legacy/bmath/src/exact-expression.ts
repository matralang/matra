import { Expr } from "./types";
import {
  addComplexFraction,
  addFraction,
  mulComplexFraction,
  mulComplexFractionByI,
  mulFraction,
  normalizeFraction,
  powComplexFractionByInteger,
  powRationalByInteger,
} from "./exact-fraction";
import type { ComplexRational, RationalParts } from "./exact-fraction";

type ExactPowerFractionResolver = (baseExpr: Expr, expExpr: Expr) => ComplexRational | null;

function exprToFraction(e: Expr): RationalParts | null {
  if (e.head === "Integer") {
    return { num: e.attributes.value, den: 1n };
  }
  if (e.head === "Rational") {
    return normalizeFraction(e.attributes.num, e.attributes.den);
  }
  if (e.head === "Plus") {
    let acc: RationalParts = { num: 0n, den: 1n };
    for (const term of e.attributes.terms) {
      const t = exprToFraction(term);
      if (!t) {
        return null;
      }
      acc = addFraction(acc, t);
    }
    return acc;
  }
  if (e.head === "Times") {
    let acc: RationalParts = { num: 1n, den: 1n };
    for (const factor of e.attributes.factors) {
      const f = exprToFraction(factor);
      if (!f) {
        return null;
      }
      acc = mulFraction(acc, f);
    }
    return acc;
  }
  if (e.head === "Power") {
    const base = exprToFraction(e.attributes.base);
    const exp = exprToFraction(e.attributes.exp);
    if (!base || !exp || exp.den !== 1n) {
      return null;
    }
    return powRationalByInteger(base, exp.num);
  }
  return null;
}

function exprToComplexFraction(e: Expr, resolveExactPower: ExactPowerFractionResolver): ComplexRational | null {
  const frac = exprToFraction(e);
  if (frac) {
    return { re: frac, im: { num: 0n, den: 1n } };
  }

  if (e.head === "GaussianInteger") {
    return {
      re: { num: e.attributes.re, den: 1n },
      im: { num: e.attributes.im, den: 1n },
    };
  }

  if (e.head === "Complex") {
    const re = exprToComplexFraction(e.attributes.re, resolveExactPower);
    const im = exprToComplexFraction(e.attributes.im, resolveExactPower);
    if (!re || !im) {
      return null;
    }
    return addComplexFraction(re, mulComplexFractionByI(im));
  }

  if (e.head === "Plus") {
    let acc: ComplexRational = {
      re: { num: 0n, den: 1n },
      im: { num: 0n, den: 1n },
    };
    for (const term of e.attributes.terms) {
      const t = exprToComplexFraction(term, resolveExactPower);
      if (!t) {
        return null;
      }
      acc = addComplexFraction(acc, t);
    }
    return acc;
  }

  if (e.head === "Times") {
    let acc: ComplexRational = {
      re: { num: 1n, den: 1n },
      im: { num: 0n, den: 1n },
    };
    for (const factor of e.attributes.factors) {
      const f = exprToComplexFraction(factor, resolveExactPower);
      if (!f) {
        return null;
      }
      acc = mulComplexFraction(acc, f);
    }
    return acc;
  }

  if (e.head === "Power") {
    const base = exprToComplexFraction(e.attributes.base, resolveExactPower);
    const exp = exprToFraction(e.attributes.exp);
    if (base && exp && exp.den === 1n) {
      return powComplexFractionByInteger(base, exp.num);
    }

    return resolveExactPower(e.attributes.base, e.attributes.exp);
  }

  return null;
}

export { exprToComplexFraction, exprToFraction };
export type { ExactPowerFractionResolver };