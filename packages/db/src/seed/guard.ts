const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "postgres"])

/** Demo data never goes near production: refused by name, and from a laptop only into a local database. */
export function assertSeedable({ deployEnv, databaseUrl }: { deployEnv?: string; databaseUrl?: string }): void {
  if (deployEnv === "production") throw new Error("Refusing to seed demo data: DEPLOY_ENV is production.")
  if (!databaseUrl || (deployEnv && deployEnv !== "local")) return
  const { hostname } = new URL(databaseUrl)
  if (!LOCAL_HOSTS.has(hostname))
    throw new Error("Refusing to seed demo data into a remote database while DEPLOY_ENV is local or unset.")
}
