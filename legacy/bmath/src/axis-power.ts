import { Expr } from "./types";
import { exprToComplexFraction, exprToFraction } from "./exact-expression";
import {
  absBigInt,
  exactNthRoot,
  intOrRatParts,
  isZeroFraction,
  mulFraction,
  normalizeFraction,
  powRationalByInteger,
} from "./exact-fraction";
import type { ComplexRational, RationalParts } from "./exact-fraction";
import type { ComplexNumber } from "./exact-complex";

function unitRootAngleOverPi(base: ComplexNumber): RationalParts | null {
  if (base.re === 1 && base.im === 0) {
    return { num: 0n, den: 1n };
  }
  if (base.re === -1 && base.im === 0) {
    return { num: 1n, den: 1n };
  }
  if (base.re === 0 && base.im === 1) {
    return { num: 1n, den: 2n };
  }
  if (base.re === 0 && base.im === -1) {
    return { num: -1n, den: 2n };
  }
  return null;
}

function exactUnitRootPower(base: ComplexNumber, exp: Expr): ComplexNumber | null {
  const thetaOverPi = unitRootAngleOverPi(base);
  const expFrac = exprToFraction(exp);
  if (!thetaOverPi || !expFrac) {
    return null;
  }

  const phase = mulFraction(thetaOverPi, expFrac);
  const twicePhase = normalizeFraction(2n * phase.num, phase.den);
  if (twicePhase.den !== 1n) {
    return null;
  }

  const mod = ((twicePhase.num % 4n) + 4n) % 4n;
  if (mod === 0n) {
    return { re: 1, im: 0 };
  }
  if (mod === 1n) {
    return { re: 0, im: 1 };
  }
  if (mod === 2n) {
    return { re: -1, im: 0 };
  }
  return { re: 0, im: -1 };
}

function exactPositiveRationalPower(base: RationalParts, expExpr: Expr): RationalParts | null {
  if (base.num < 0n || base.den <= 0n) {
    return null;
  }

  const exp = exprToFraction(expExpr);
  if (!exp) {
    return null;
  }

  if (exp.den <= 0n) {
    return null;
  }

  const rootNum = exactNthRoot(base.num, exp.den);
  const rootDen = exactNthRoot(base.den, exp.den);
  if (rootNum === null || rootDen === null) {
    return null;
  }

  return powRationalByInteger({ num: rootNum, den: rootDen }, exp.num);
}

function axisUnitAndMagnitude(baseExpr: Expr): { unit: ComplexNumber; magnitude: RationalParts } | null {
  const exactBase = exprToComplexFraction(baseExpr, exactAxisUnitMagnitudePowerAsFraction);
  if (exactBase) {
    const re = exactBase.re;
    const im = exactBase.im;

    if (isZeroFraction(im) && !isZeroFraction(re)) {
      const sign = re.num < 0n ? -1 : 1;
      return {
        unit: sign < 0 ? { re: -1, im: 0 } : { re: 1, im: 0 },
        magnitude: { num: absBigInt(re.num), den: re.den },
      };
    }

    if (isZeroFraction(re) && !isZeroFraction(im)) {
      const sign = im.num < 0n ? -1 : 1;
      return {
        unit: sign < 0 ? { re: 0, im: -1 } : { re: 0, im: 1 },
        magnitude: { num: absBigInt(im.num), den: im.den },
      };
    }
  }

  const real = intOrRatParts(baseExpr);
  if (real) {
    const absVal = absBigInt(real.num);
    return {
      unit: real.num < 0n ? { re: -1, im: 0 } : { re: 1, im: 0 },
      magnitude: { num: absVal, den: real.den },
    };
  }

  const imagPart = (expr: Expr): RationalParts | null => intOrRatParts(expr);

  if (baseExpr.head === "GaussianInteger") {
    if (baseExpr.attributes.re === 0n && baseExpr.attributes.im !== 0n) {
      return {
        unit: baseExpr.attributes.im < 0n ? { re: 0, im: -1 } : { re: 0, im: 1 },
        magnitude: { num: absBigInt(baseExpr.attributes.im), den: 1n },
      };
    }
    return null;
  }

  if (baseExpr.head === "Complex") {
    const re = imagPart(baseExpr.attributes.re);
    const im = imagPart(baseExpr.attributes.im);
    if (!re || !im) {
      return null;
    }

    if (re.num === 0n && im.num !== 0n) {
      return {
        unit: im.num < 0n ? { re: 0, im: -1 } : { re: 0, im: 1 },
        magnitude: { num: absBigInt(im.num), den: im.den },
      };
    }
  }

  return null;
}

function exactAxisUnitMagnitudePower(baseExpr: Expr, expExpr: Expr): ComplexNumber | null {
  const axis = axisUnitAndMagnitude(baseExpr);
  if (!axis) {
    return null;
  }

  const unitPow = exactUnitRootPower(axis.unit, expExpr);
  if (!unitPow) {
    return null;
  }

  const magPow = exactPositiveRationalPower(axis.magnitude, expExpr);
  if (!magPow) {
    return null;
  }

  const amp = Number(magPow.num) / Number(magPow.den);
  return {
    re: unitPow.re * amp,
    im: unitPow.im * amp,
  };
}

function exactAxisUnitMagnitudePowerAsFraction(baseExpr: Expr, expExpr: Expr): ComplexRational | null {
  const axis = axisUnitAndMagnitude(baseExpr);
  if (!axis) {
    return null;
  }

  const unitPow = exactUnitRootPower(axis.unit, expExpr);
  if (!unitPow) {
    return null;
  }

  const magPow = exactPositiveRationalPower(axis.magnitude, expExpr);
  if (!magPow) {
    return null;
  }

  const zero: RationalParts = { num: 0n, den: 1n };
  const negativeMag = normalizeFraction(-magPow.num, magPow.den);

  if (unitPow.re === 1 && unitPow.im === 0) {
    return { re: magPow, im: zero };
  }
  if (unitPow.re === -1 && unitPow.im === 0) {
    return { re: negativeMag, im: zero };
  }
  if (unitPow.re === 0 && unitPow.im === 1) {
    return { re: zero, im: magPow };
  }
  if (unitPow.re === 0 && unitPow.im === -1) {
    return { re: zero, im: negativeMag };
  }

  return null;
}

export { exactAxisUnitMagnitudePower, exactAxisUnitMagnitudePowerAsFraction, exactUnitRootPower };