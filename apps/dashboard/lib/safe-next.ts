/** Only same-site paths: `//evil.test` and `https://…` would turn the sign-in redirect into an open redirect. */
export function safeNext(value: string | string[] | undefined | null): string {
  const next = Array.isArray(value) ? value[0] : value
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/"
  return next
}
