import { Expr, IntegerExpr } from "./types";

function normalize(m: Expr): Expr {
  if (m.head === "Plus") {
    let numericNum = 0n;
    let numericDen = 1n;
    const otherTerms: Expr[] = [];

    for (const term of m.attributes.terms) {
      if (term.head === "Integer") {
        numericNum += term.attributes.value * numericDen;
      } else if (term.head === "Rational") {
        numericNum = numericNum * term.attributes.den + term.attributes.num * numericDen;
        numericDen *= term.attributes.den;
      } else {
        otherTerms.push(term);
      }
    }

    const numeric = numberExpr(numericNum, numericDen);
    const allTerms = isZero(numeric) ? otherTerms : [numeric, ...otherTerms];
    
    if (allTerms.length === 0) {
      return int(0n);
    } else if (allTerms.length === 1) {
      return allTerms[0];
    } else {
      return { head: "Plus", attributes: { terms: allTerms } };
    }
  } else if (m.head === "Times") {
    let numericNum = 1n;
    let numericDen = 1n;
    const otherFactors: Expr[] = [];

    for (const factor of m.attributes.factors) {
      if (factor.head === "Integer") {
        numericNum *= factor.attributes.value;
      } else if (factor.head === "Rational") {
        numericNum *= factor.attributes.num;
        numericDen *= factor.attributes.den;
      } else {
        otherFactors.push(factor);
      }
    }

    if (numericNum === 0n) {
      return int(0n);
    }

    const numeric = numberExpr(numericNum, numericDen);
    const allFactors = isOne(numeric) ? otherFactors : [numeric, ...otherFactors];
    
    if (allFactors.length === 0) {
      return int(1n);
    } else if (allFactors.length === 1) {
      return allFactors[0];
    } else {
      return { head: "Times", attributes: { factors: allFactors } };
    }
  } else if (m.head === "Power") {
    const base = m.attributes.base;
    const exp = m.attributes.exp;

    if (base.head === "Integer" && exp.head === "Integer") {
      if (exp.attributes.value === 0n) {
        return int(1n);
      }

      if (base.attributes.value === 0n) {
        return int(0n);
      }
    }

    return {
      head: "Power",
      attributes: { base, exp },
    };
  } else if (m.head === "Call") {
    return m;
  } else {
    return m;
  }
}

const int = (value: bigint): IntegerExpr => ({ head: "Integer", attributes: { value } });

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
};

const normalizeRational = (num: bigint, den: bigint): Expr => {
  // gcdで約分
  // den > 0 に正規化

  if (den === 0n) {
    throw new Error("Denominator cannot be zero");
  }

  const g = gcd(num, den);
  let n = num / g;
  let d = den / g;
  
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  
  return { head: "Rational", attributes: { num: n, den: d } };
};

const numberExpr = (num: bigint, den: bigint): Expr => {
  const normalized = normalizeRational(num, den);
  return normalized.head === "Rational" && normalized.attributes.den === 1n
    ? int(normalized.attributes.num)
    : normalized;
};

const isZero = (expr: Expr): boolean =>
  expr.head === "Integer" && expr.attributes.value === 0n;

const isOne = (expr: Expr): boolean =>
  expr.head === "Integer" && expr.attributes.value === 1n;

const sym = (name: string): Expr => ({ head: "Symbol", attributes: { name } });

const rat = (num: bigint, den: bigint): Expr => {
  return normalizeRational(num, den);
};

const gi = (re: bigint, im: bigint): Expr => {
  return { head: "GaussianInteger", attributes: { re, im } };
};

const complex = (re: Expr, im: Expr): Expr => {
  return { head: "Complex", attributes: { re, im } };
};

const power = (base: Expr, exp: Expr): Expr => {
  return normalize({
    head: "Power",
    attributes: { base, exp },
  });
};

const plus = (...terms: Expr[]): Expr => {
  return normalize({
    head: "Plus",
    attributes: { terms },
  });
}

const times = (...factors: Expr[]): Expr => {
  return normalize({
    head: "Times",
    attributes: { factors },
  });
}

const call = (fn: string, arg: Expr): Expr => ({
  head: "Call",
  attributes: { fn, arg },
});

export { int, sym, rat, gi, complex, power, plus, times, call, normalizeRational };
