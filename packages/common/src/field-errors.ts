/** The field the api refused (`phone`, `consents.whatsapp`), from the issues of a BAD_REQUEST. */
export function invalidField(error: unknown): string | null {
  const issues = (error as { data?: { issues?: { path?: PropertyKey[] }[] } } | null)?.data?.issues
  const path = issues?.[0]?.path
  return path?.length ? path.map(String).join(".") : null
}
