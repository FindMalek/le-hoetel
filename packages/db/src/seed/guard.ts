const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "postgres"])

export interface SeedTarget {
  deployEnv?: string
  databaseUrl: string
}

/** Why demo data must not be written there, or null: never production, and from a laptop only a local database. */
export function seedRefusal({ deployEnv, databaseUrl }: SeedTarget): string | null {
  if (deployEnv === "production") return "Refusing to seed demo data: DEPLOY_ENV is production."
  if (deployEnv && deployEnv !== "local") return null
  if (LOCAL_HOSTS.has(new URL(databaseUrl).hostname)) return null
  return "Refusing to seed demo data into a remote database while DEPLOY_ENV is local or unset."
}

export function assertSeedable(target: SeedTarget): void {
  const refusal = seedRefusal(target)
  if (refusal) throw new Error(refusal)
}
