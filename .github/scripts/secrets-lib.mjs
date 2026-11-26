export const ENVIRONMENTS = ["dev", "staging", "prod", "preview"]

export const infisicalConfigured = (env = process.env) =>
  Boolean(env.INFISICAL_URL && env.INFISICAL_PROJECT_ID && env.INFISICAL_CLIENT_ID && env.INFISICAL_CLIENT_SECRET)

export function parseDotenv(text = "") {
  const out = {}
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

export const formatDotenv = (values) =>
  Object.entries(values)
    .map(([k, v]) => `${k}=${String(v).replace(/\r?\n/g, "\\n")}`)
    .join("\n")

export async function infisicalLogin(env = process.env) {
  if (!infisicalConfigured(env))
    throw new Error("set INFISICAL_URL, INFISICAL_PROJECT_ID, INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET")
  const base = env.INFISICAL_URL.replace(/\/+$/, "")
  const login = await fetch(`${base}/api/v1/auth/universal-auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId: env.INFISICAL_CLIENT_ID, clientSecret: env.INFISICAL_CLIENT_SECRET }),
  })
  if (!login.ok) throw new Error(`infisical login failed (${login.status})`)
  const { accessToken } = await login.json()
  return { base, accessToken }
}

export async function pushSecret(environment, key, value, env = process.env) {
  const { base, accessToken } = await infisicalLogin(env)
  const res = await fetch(`${base}/api/v3/secrets/raw/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: env.INFISICAL_PROJECT_ID,
      environment,
      secretPath: "/",
      secretValue: value,
      type: "shared",
    }),
  })
  if (!res.ok) throw new Error(`infisical write of ${key} to ${environment} failed (${res.status})`)
}

export async function pullSecrets(environment, env = process.env) {
  if (!ENVIRONMENTS.includes(environment)) throw new Error(`environment must be one of ${ENVIRONMENTS.join(", ")}`)
  const { base, accessToken } = await infisicalLogin(env)
  const query = new URLSearchParams({
    workspaceId: env.INFISICAL_PROJECT_ID,
    environment,
    secretPath: "/",
    include_imports: "true",
  })
  const res = await fetch(`${base}/api/v3/secrets/raw?${query}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`infisical export of ${environment} failed (${res.status})`)
  const { secrets } = await res.json()
  return Object.fromEntries(secrets.map((s) => [s.secretKey, s.secretValue]))
}
