const SECRET_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|credential|session|dsn/i
const PII_KEY = /phone|mobile|msisdn|whatsapp|e[-_]?mail|^(first|last|full|given|family|guest|display|user)?[-_]?name$/i
const EMAIL_VALUE = /[\w.+-]+@[\w-]+\.[\w.-]+/g
// An international number (`+216 20 123 456`) or a bare run of 8+ digits. Dates and short ids stay readable.
const PHONE_VALUE = /\+\d(?:[\s().-]?\d){6,15}|(?<![\w-])\d{8,15}(?![\w-])/g
const MAX_DEPTH = 6

export const REDACTED = "[redacted]"

/** Copies `value` with every secret or guest data (phone, email, name) key blanked, email addresses inside strings masked and errors flattened, so a log line can't leak a credential. */
/** Masks email addresses and phone numbers inside free text, e.g. an error message. */
export const maskText = (text: string): string => text.replace(EMAIL_VALUE, REDACTED).replace(PHONE_VALUE, REDACTED)

/** A drizzle query error carries the query and its params (guest phone, name) in its message: keep only the class and the Postgres code. */
function isQueryError(value: Error): value is Error & { query: unknown } {
  return "query" in value && ("params" in value || "parameters" in value)
}

export function errorSummary(error: unknown): { name: string; code?: string } {
  if (!(error instanceof Error)) return { name: typeof error }
  const source = (error.cause ?? error) as { code?: unknown }
  return {
    name: error.constructor.name || error.name,
    ...(typeof source.code === "string" ? { code: source.code } : {}),
  }
}

export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    if (isQueryError(value)) return errorSummary(value)
    const extra = redact({ ...value }, depth + 1, seen) as Record<string, unknown>
    const cause = value.cause === undefined ? {} : { cause: redact(value.cause, depth + 1, seen) }
    return { name: value.name, message: redact(value.message), stack: redact(value.stack), ...cause, ...extra }
  }
  if (typeof value === "string") return maskText(value)
  if (value === null || typeof value !== "object") return typeof value === "bigint" ? value.toString() : value
  if (value instanceof Headers) return redact(Object.fromEntries(value.entries()), depth, seen)
  if (value instanceof Date) return value.toISOString()
  if (seen.has(value) || depth >= MAX_DEPTH) return "[truncated]"
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1, seen))
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    out[key] = SECRET_KEY.test(key) || PII_KEY.test(key) ? REDACTED : redact(item, depth + 1, seen)
  }
  return out
}
