import { Expr, MorphionForm, PolynarionForm } from "./types";
import { replacer } from "./json";
import { int, sym } from "./expr";
import { normalizeRational } from "./expr";
import { morphion } from "./morphion";
import { exactAxisUnitMagnitudePower, exactRealRationalPower, exactUnitRootPower, powComplexInteger } from "./exact-complex";
import type { ComplexNumber } from "./exact-complex";

function asComplexOrZero(n: Expr | MorphionForm): ComplexNumber {
  const c = toComplex(n);
  if (typeof c === "object" && "re" in c && "im" in c) {
    return { re: Number(c.re), im: Number(c.im) };
  }
  return { re: 0, im: 0 };
}

function toNum(n: Expr | MorphionForm): number {
  if (n.head === "Integer") {
    return Number(n.attributes.value);
  } else if (n.head === "Rational") {
    return Number(n.attributes.num) / Number(n.attributes.den);
  } else if (n.head === "GaussianInteger") {
    return NaN; // ガウス整数は数値に変換できないのでNaNを返す
  } else if (n.head === "Complex") {
    return NaN; // 複素数は数値に変換できないのでNaNを返す
  } else if (n.head === "Power") {
    return Math.pow(toNum(n.attributes.base), toNum(n.attributes.exp));
  } else if (n.head === "Plus") {
    return n.attributes.terms.reduce((sum, term) => sum + toNum(term), 0);
  } else if (n.head === "Times") {
    return n.attributes.factors.reduce((product, factor) => product * toNum(factor), 1);
  } else if (n.head === "MorphionForm") {
    let result = 0;
    for (const { key, coeff } of n.attributes.terms.values()) {
      result += toNum(coeff) * Math.pow(toNum(n.attributes.base), toNum(key));
    }
    return result;
  } else if (n.head === "Symbol") {
    return NaN; // シンボルは数値に変換できないのでNaNを返す
  } else if (n.head === "Call") {
    return NaN; // 関数呼び出しは数値に変換できないのでNaNを返す
  } else {
    throw new Error("Unsupported Morphion type for toNum");
  }
}

function gaussianToComplex(n: Expr): { re: number; im: number } {
  if (n.head === "GaussianInteger") {
    return { re: Number(n.attributes.re), im: Number(n.attributes.im) };
  } else {
    throw new Error("Unsupported Expr type for gaussianToComplex");
  }
}

function toComplex(n: Expr | MorphionForm): { re: number; im: number } | MorphionForm {
  if (n.head === "Integer") {
    return { re: Number(n.attributes.value), im: 0 };
  } else if (n.head === "Rational") {
    return { re: Number(n.attributes.num) / Number(n.attributes.den), im: 0 };
  } else if (n.head === "GaussianInteger") {
    return gaussianToComplex(n);
  } else if (n.head === "Complex") {
    const rePart = asComplexOrZero(n.attributes.re);
    const imPart = asComplexOrZero(n.attributes.im);
    return {
      re: rePart.re - imPart.im,
      im: rePart.im + imPart.re,
    };
  } else if (n.head === "MorphionForm") {
    return n; // MorphionFormはそのまま返す
  } else if (n.head === "Symbol") {
    return { re: NaN, im: NaN }; // シンボルは複素数に変換できないのでNaNを返す
  } else if (n.head === "Power") {
    const exactReal = exactRealRationalPower(n.attributes.base, n.attributes.exp);
    if (exactReal !== null) {
      return exactReal;
    }

    const exactAxis = exactAxisUnitMagnitudePower(n.attributes.base, n.attributes.exp);
    if (exactAxis !== null) {
      return exactAxis;
    }

    const base = asComplexOrZero(n.attributes.base);

    const exactUnitRoot = exactUnitRootPower(base, n.attributes.exp);
    if (exactUnitRoot !== null) {
      return exactUnitRoot;
    }

    if (n.attributes.exp.head === "Integer") {
      return powComplexInteger(base, n.attributes.exp.attributes.value);
    }

    if (n.attributes.exp.head === "Rational") {
      if (n.attributes.exp.attributes.den === 1n) {
        return powComplexInteger(base, n.attributes.exp.attributes.num);
      }

      // principal square root of -1 is exactly i
      if (n.attributes.exp.attributes.num === 1n && n.attributes.exp.attributes.den === 2n && base.re === -1 && base.im === 0) {
        return { re: 0, im: 1 };
      }
    }

    const expNum = toNum(n.attributes.exp);
    if (base.im === 0 && base.re >= 0) {
      return { re: Math.pow(base.re, expNum), im: 0 };
    }

    const r = Math.sqrt(base.re * base.re + base.im * base.im);
    const theta = Math.atan2(base.im, base.re);
    const rExp = Math.pow(r, expNum);
    const thetaExp = theta * expNum;

    return {
      re: rExp * Math.cos(thetaExp),
      im: rExp * Math.sin(thetaExp),
    };
  } else if (n.head === "Plus") {
    let re = 0;
    let im = 0;
    for (const term of n.attributes.terms) {
      const termCplx = toComplex(term);
      const termCplxObj = (typeof termCplx === "object" && "re" in termCplx) ? termCplx : { re: 0, im: 0 };
      re += typeof termCplxObj.re === "number" ? termCplxObj.re : 0;
      im += typeof termCplxObj.im === "number" ? termCplxObj.im : 0;
    }
    
    return { re, im };
  } else if (n.head === "Times") {
    let re = 1;
    let im = 0;
    for (const factor of n.attributes.factors) {
      const factorCplx = toComplex(factor);
      const factorCplxObj = (typeof factorCplx === "object" && "re" in factorCplx) ? factorCplx : { re: 0, im: 0 };
      const re_val = typeof factorCplxObj.re === "number" ? factorCplxObj.re : 0;
      const im_val = typeof factorCplxObj.im === "number" ? factorCplxObj.im : 0;
      const newRe = re * re_val - im * im_val;
      const newIm = re * im_val + im * re_val;
      re = newRe;
      im = newIm;
    }
    
    return { re, im };
  } else if (n.head === "Call") {
    return { re: NaN, im: NaN }; // 関数呼び出しは複素数に変換できないのでNaNを返す
  } else {
    throw new Error("Unsupported Morphion type for toComplex");
  }
}

function toExpression(n: Expr | MorphionForm): string {
  if (n.head === "Integer") {
    return n.attributes.value.toString();
  } else if (n.head === "Rational") {
    return `(${toExpression(int(n.attributes.num))}/${toExpression(int(n.attributes.den))})`;
  } else if (n.head === "Complex") {
    return `(${toExpression(n.attributes.re)} + ${toExpression(n.attributes.im)}i)`;
  } else if (n.head === "Power") {
    return `(${toExpression(n.attributes.base)}^(${toExpression(n.attributes.exp)}))`;
  } else if (n.head === "Plus") {
    return n.attributes.terms.map(term => toExpression(term)).join(" + ");
  } else if (n.head === "Times") {
    return n.attributes.factors.map(factor => toExpression(factor)).join(" * ");
  } else if (n.head === "MorphionForm") {
    return Array.from(n.attributes.terms.values()).map(({ key, coeff }: { key: Expr; coeff: Expr }) => `(${toExpression(coeff)}) * (${toExpression(n.attributes.base)}^(${toExpression(key)}))`).join(" + ");
  } else if (n.head === "Symbol") {
    return n.attributes.name;
  } else if (n.head === "Call") {
    return `${n.attributes.fn}(${toExpression(n.attributes.arg)})`;
  } else {
    throw new Error("Unsupported Morphion type for toExpression");
  }
}

function rationalAsMorphion(num: bigint, den: bigint): PolynarionForm {
  const frac = normalizeRational(num, den);
  if (frac.head === "Rational") {
    return morphion(int(frac.attributes.den), [{ key: int(-1n), coeff: int(frac.attributes.num) }]);
  }
  return morphion(int(1n), [{ key: int(0n), coeff: frac }]);
}

const ii = sym("i");

function complexAsMorphion(re: Expr, im: Expr): PolynarionForm {
  return morphion(ii, [
    { key: int(0n), coeff: re },
    { key: int(1n), coeff: im },
  ]);
}

function toMorphionForm(n: Expr): PolynarionForm {
  if (n.head === "Integer") {
    return morphion(int(1n), [{ key: int(0n), coeff: n }]);
  } else if (n.head === "Rational") {
    return rationalAsMorphion(n.attributes.num, n.attributes.den);
  } else if (n.head === "GaussianInteger") {
    return complexAsMorphion(int(n.attributes.re), int(n.attributes.im));
  } else if (n.head === "Complex") {
    return complexAsMorphion(n.attributes.re, n.attributes.im);
  } else if (n.head === "Power") {
    if (n.attributes.base.head === "Symbol" && n.attributes.base.attributes.name === "x") {
      if (n.attributes.exp.head !== "Integer") {
        throw new Error("Unsupported exponent for Power in toMorphionForm");
      }
      return morphion(sym("x"), [{ key: n.attributes.exp, coeff: int(1n) }]);
    } else {
      throw new Error("Unsupported base for Power in toMorphionForm");
    }
  } else if (n.head === "Symbol") {
    return morphion(n, [{ key: int(1n), coeff: int(1n) }]);
  } else if (n.head === "Call") {
    throw new Error(`Cannot morphionize Call: ${n.attributes.fn}`);
  } else {
    throw new Error(`Cannot morphionize ${n.head}`);
  }
}

function toJson(n: Expr | MorphionForm): string {
  return JSON.stringify(n, replacer);
}

export { toNum, toComplex, toExpression, toJson, toMorphionForm };
