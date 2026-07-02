/** Compose Matra source while keeping page modules readable. */
export function matra(
  strings: TemplateStringsArray | string[],
  ...values: unknown[]
): string {
  return strings.reduce(
    (source, part, index) => source + part + (values[index] ?? ""),
    "",
  )
}

/** Quote plain text for Matra's double-quoted string syntax. */
export function text(value: string): string {
  if (value.includes('"') || value.includes("\n")) {
    throw new TypeError("Matra text interpolation cannot contain quotes or newlines")
  }
  return `"${value}"`
}
