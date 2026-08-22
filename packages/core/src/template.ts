export type MatraRawSource = { readonly kind: "MatraRawSource", readonly source: string }

export interface MatraTemplate {
  (strings: TemplateStringsArray, ...values: unknown[]): string
  raw(source: string): MatraRawSource
}

export const matra = Object.assign(
  (strings: TemplateStringsArray, ...values: unknown[]) => renderMatraTemplate(strings, values),
  {
    raw(source: string): MatraRawSource {
      return { kind: "MatraRawSource", source }
    },
  },
) as MatraTemplate

export function isMatraTemplateStrings(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && "raw" in value
}

export function renderMatraTemplate(strings: TemplateStringsArray, values: unknown[]): string {
  return strings.reduce(
    (result, chunk, index) => result + chunk + (index < values.length ? interpolateTemplate(values[index]) : ""),
    "",
  )
}

function interpolateTemplate(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (isRawSource(value)) return value.source
  if (typeof value === "string") return JSON.stringify(value)
  if (Array.isArray(value)) return value.map(interpolateTemplate).join("\n")
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  throw new TypeError(`Unsupported Matra template value: ${typeof value}`)
}

function isRawSource(value: unknown): value is MatraRawSource {
  return typeof value === "object" && value !== null &&
    "kind" in value && value.kind === "MatraRawSource" &&
    "source" in value && typeof value.source === "string"
}
