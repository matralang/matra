import { Expr } from "./types";

type RationalParts = { num: bigint; den: bigint };
type ComplexRational = { re: RationalParts; im: RationalParts };

function absBigInt(n: bigint): bigint {
  return n < 0n ? -n : n;
}

function powBigInt(base: bigint, exp: bigint): bigint {
  if (exp < 0n) {
    throw new Error("powBigInt exponent must be non-negative");
  }
  let e = exp;
  let b = base;
  let result = 1n;
  while (e > 0n) {
    if ((e & 1n) === 1n) {
      result *= b;
    }
    b *= b;
    e >>= 1n;
  }
  return result;
}

function exactNthRoot(value: bigint, n: bigint): bigint | null {
  if (n <= 0n || value < 0n) {
    return null;
  }
  if (value === 0n || value === 1n || n === 1n) {
    return value;
  }

  let low = 0n;
  let high = value;

  while (low <= high) {
    const mid = (low + high) >> 1n;
    const midPow = powBigInt(mid, n);
    if (midPow === value) {
      return mid;
    }
    if (midPow < value) {
      low = mid + 1n;
    } else {
      high = mid - 1n;
    }
  }

  return null;
}

function normalizeFraction(num: bigint, den: bigint): RationalParts {
  if (den === 0n) {
    throw new Error("Denominator cannot be zero");
  }

  let n = num;
  let d = den;
  if (d < 0n) {
    n = -n;
    d = -d;
  }

  const g = absBigInt(gcdBigInt(n, d));
  return { num: n / g, den: d / g };
}

function gcdBigInt(a: bigint, b: bigint): bigint {
  let x = absBigInt(a);
  let y = absBigInt(b);
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

function intOrRatParts(e: Expr): RationalParts | null {
  if (e.head === "Integer") {
    return { num: e.attributes.value, den: 1n };
  }
  if (e.head === "Rational") {
    return normalizeFraction(e.attributes.num, e.attributes.den);
  }
  return null;
}

function mulFraction(a: RationalParts, b: RationalParts): RationalParts {
  return normalizeFraction(a.num * b.num, a.den * b.den);
}

function subFraction(a: RationalParts, b: RationalParts): RationalParts {
  return normalizeFraction(a.num * b.den - b.num * a.den, a.den * b.den);
}

function divFraction(a: RationalParts, b: RationalParts): RationalParts | null {
  if (b.num === 0n) {
    return null;
  }
  return normalizeFraction(a.num * b.den, a.den * b.num);
}

function addFraction(a: RationalParts, b: RationalParts): RationalParts {
  return normalizeFraction(a.num * b.den + b.num * a.den, a.den * b.den);
}

function isZeroFraction(a: RationalParts): boolean {
  return a.num === 0n;
}

function addComplexFraction(a: ComplexRational, b: ComplexRational): ComplexRational {
  return {
    re: addFraction(a.re, b.re),
    im: addFraction(a.im, b.im),
  };
}

function mulComplexFraction(a: ComplexRational, b: ComplexRational): ComplexRational {
  return {
    re: subFraction(mulFraction(a.re, b.re), mulFraction(a.im, b.im)),
    im: addFraction(mulFraction(a.re, b.im), mulFraction(a.im, b.re)),
  };
}

function mulComplexFractionByI(value: ComplexRational): ComplexRational {
  return {
    re: normalizeFraction(-value.im.num, value.im.den),
    im: value.re,
  };
}

function invComplexFraction(a: ComplexRational): ComplexRational | null {
  const denom = addFraction(mulFraction(a.re, a.re), mulFraction(a.im, a.im));
  if (isZeroFraction(denom)) {
    return null;
  }

  const re = divFraction(a.re, denom);
  const im = divFraction(normalizeFraction(-a.im.num, a.im.den), denom);
  if (!re || !im) {
    return null;
  }

  return { re, im };
}

function powComplexFractionByInteger(base: ComplexRational, exp: bigint): ComplexRational | null {
  if (exp === 0n) {
    return {
      re: { num: 1n, den: 1n },
      im: { num: 0n, den: 1n },
    };
  }

  let e = exp < 0n ? -exp : exp;
  let b: ComplexRational = { re: base.re, im: base.im };
  let result: ComplexRational = {
    re: { num: 1n, den: 1n },
    im: { num: 0n, den: 1n },
  };

  while (e > 0n) {
    if ((e & 1n) === 1n) {
      result = mulComplexFraction(result, b);
    }
    b = mulComplexFraction(b, b);
    e >>= 1n;
  }

  if (exp > 0n) {
    return result;
  }

  return invComplexFraction(result);
}

function powRationalByInteger(base: RationalParts, exp: bigint): RationalParts {
  if (exp === 0n) {
    return { num: 1n, den: 1n };
  }

  const absExp = absBigInt(exp);
  const numPow = powBigInt(base.num, absExp);
  const denPow = powBigInt(base.den, absExp);

  if (exp > 0n) {
    return { num: numPow, den: denPow };
  }

  return { num: denPow, den: numPow };
}

export {
  absBigInt,
  addComplexFraction,
  addFraction,
  divFraction,
  exactNthRoot,
  intOrRatParts,
  invComplexFraction,
  isZeroFraction,
  mulComplexFraction,
  mulComplexFractionByI,
  mulFraction,
  normalizeFraction,
  powBigInt,
  powComplexFractionByInteger,
  powRationalByInteger,
  subFraction,
};
export type { ComplexRational, RationalParts };