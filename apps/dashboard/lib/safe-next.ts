/** Only same-site paths: `//evil.test`, `https://…` and a tab or newline smuggled after the slash would turn the sign-in redirect into an open redirect. */
export function safeNext(value: string | string[] | undefined | null): string {
  const next = Array.isArray(value) ? value[0] : value
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/"
  for (const char of next) if (char.charCodeAt(0) < 32) return "/"
  return next
}
