import { Expr, IntegerExpr, MorphionForm, MorphionTerm, PolynarionForm } from "./types";
import { replacer } from "./json";
import { int, sym, plus, times } from "./expr";

function morphion<Key extends Expr = Expr>(
  base: Expr,
  entries: MorphionTerm<Key>[]
): MorphionForm<Key> {
  const terms = new Map<string, MorphionTerm<Key>>();
  for (const entry of entries) {
    mergeTerm(terms, entry);
  }
  return { head: "MorphionForm", attributes: { base, terms } };
}

function polynarion(
  base: Expr,
  entries: MorphionTerm<IntegerExpr>[]
): PolynarionForm {
  return morphion(base, entries);
}

function poly(
  variable: string,
  coeffs: Array<{ key: bigint; coeff: Expr }>
): PolynarionForm {
  const x = sym(variable);

  return polynarion(x, coeffs.map(({ key, coeff }) => ({ key: int(key), coeff })));
}

function keyOf(e: Expr): string {
  return JSON.stringify(e, replacer);
}

function mergeTerm<Key extends Expr>(terms: Map<string, MorphionTerm<Key>>, term: MorphionTerm<Key>): void {
  const keyStr = keyOf(term.key);
  const existing = terms.get(keyStr);
  terms.set(keyStr, existing
    ? { key: term.key, coeff: plus(existing.coeff, term.coeff) }
    : term);
}

function assertSameBase(a: MorphionForm, b: MorphionForm, operation: "add" | "multiply"): Expr {
  if (!sameExpr(a.attributes.base, b.attributes.base)) {
    if (operation === "add") {
      throw new Error("Cannot add MorphionForms with different bases");
    }
    throw new Error("Cannot multiply MorphionForms with different bases");
  }

  return a.attributes.base;
}

function sameExpr(a: Expr, b: Expr): boolean {
  return keyOf(a) === keyOf(b);
}

// same base only
function addMorphionForms<Key extends Expr>(a: MorphionForm<Key>, b: MorphionForm<Key>): MorphionForm<Key> {
  const base = assertSameBase(a, b, "add");
  const terms = new Map<string, MorphionTerm<Key>>();

  for (const term of a.attributes.terms.values()) {
    terms.set(keyOf(term.key), term);
  }

  for (const term of b.attributes.terms.values()) {
    mergeTerm(terms, term);
  }

  return morphion(base, Array.from(terms.values()));
}

function addPolynarionForms(a: PolynarionForm, b: PolynarionForm): PolynarionForm {
  return addMorphionForms(a, b);
}

function addIntegerKeys(a: IntegerExpr, b: IntegerExpr): IntegerExpr {
  return int(a.attributes.value + b.attributes.value);
}

function mulPolynarionForms(a: PolynarionForm, b: PolynarionForm): PolynarionForm {
  const base = assertSameBase(a, b, "multiply");
  const terms = new Map<string, MorphionTerm<IntegerExpr>>();

  for (const { key: keyA, coeff: coeffA } of a.attributes.terms.values()) {
    for (const { key: keyB, coeff: coeffB } of b.attributes.terms.values()) {
      mergeTerm(terms, {
        key: addIntegerKeys(keyA, keyB),
        coeff: times(coeffA, coeffB),
      });
    }
  }

  return polynarion(base, Array.from(terms.values()));
}

// same base only
function mulMorphionForms(a: MorphionForm, b: MorphionForm): MorphionForm {
  const base = assertSameBase(a, b, "multiply");
  const terms = new Map<string, MorphionTerm>();

  for (const { key: keyA, coeff: coeffA } of a.attributes.terms.values()) {
    for (const { key: keyB, coeff: coeffB } of b.attributes.terms.values()) {
      mergeTerm(terms, {
        key: plus(keyA, keyB),
        coeff: times(coeffA, coeffB),
      });
    }
  }

  return morphion(base, Array.from(terms.values()));
}

export { morphion, polynarion, poly, addMorphionForms, addPolynarionForms, mulMorphionForms, mulPolynarionForms };
