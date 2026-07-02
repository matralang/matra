import { numericEvaluateMatra } from '@matra/math-compute-engine';

type NumericScope = Readonly<Record<string, number>>;

/** Evaluate a numeric Matra formula and keep example code strongly typed. */
export function calculate(source: string, scope: NumericScope = {}): number {
  const result = numericEvaluateMatra(source, scope);
  // Compute Engine preserves high-precision decimals as numeric strings.
  const value = typeof result === 'number' || typeof result === 'string' ? Number(result) : Number.NaN;
  if (!Number.isFinite(value)) {
    throw new TypeError(`Matra formula did not produce a finite number: ${source}`);
  }
  return value;
}

/** Cartesian offset for a point distributed around a circle. */
export function polarOffset(radius: number, index: number, count: number, turns = 0): [number, number] {
  return polarOffsetFormula('index', { index }, radius, count, turns);
}

/** Polar offset whose index is itself expressed in Matra. */
export function polarOffsetFormula(
  indexFormula: string,
  variables: NumericScope,
  radius: number,
  count: number,
  turns = 0,
): [number, number] {
  const scope = { ...variables, radius, count, turns };
  const angle = `Add(Divide(Multiply(2, Pi, ${indexFormula}), count), Multiply(turns, Pi))`;
  return [
    calculate(`Negate(Multiply(radius, Cos(${angle})))`, scope),
    calculate(`Negate(Multiply(radius, Sin(${angle})))`, scope),
  ];
}

/** Fibonacci-based label used by the Raiun examples. */
export function fibonacciDigit(index: number, factor: number): number {
  return calculate('Mod(Multiply(factor, Fibonacci(index)), 9)', { index, factor });
}
