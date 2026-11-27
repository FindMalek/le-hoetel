import { BASE_DATABASE_URL } from "../env"

/** Own ports and database, so shooting never touches a dev or smoke test stack. */
export const URLS = {
  web: "http://localhost:4292",
  api: "http://localhost:4293",
  dashboard: "http://localhost:4294",
}

export const GUIDE_DATABASE = "ritorno_guide"

export function guideDatabaseUrl(): string {
  const url = new URL(BASE_DATABASE_URL)
  url.pathname = `/${GUIDE_DATABASE}`
  return url.toString()
}
