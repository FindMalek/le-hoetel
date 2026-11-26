// Every app reports the commit its image was built from. A deploy is healthy only when all of them report the new one
// in the same round; a crashed app answers 404 from Traefik and keeps the run waiting until it fails.
export const HEALTH_PATHS = { api: "/health", web: "/api/health", dashboard: "/api/health", docs: "/api/health" }

async function probe(url, sha, fetch) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    const body = await res.json().catch(() => ({}))
    if (res.status === 200 && body.sha === sha) return null
    return `status ${res.status}, sha ${body.sha ?? "none"}`
  } catch {
    return "no answer"
  }
}

/** Resolves to `[]` once all apps are on `sha`, or after `timeoutMs` to one line per app that is not. */
export async function waitForHealthy(urls, sha, options = {}) {
  const { fetch = globalThis.fetch, timeoutMs = 20 * 60_000, intervalMs = 20_000 } = options
  const end = Date.now() + timeoutMs
  for (;;) {
    const results = await Promise.all(
      Object.entries(HEALTH_PATHS).map(async ([app, path]) => {
        const url = `${urls[app].replace(/\/+$/, "")}${path}`
        const problem = await probe(url, sha, fetch)
        return problem && `${app} (${url}): ${problem}`
      }),
    )
    const failing = results.filter(Boolean)
    if (failing.length === 0 || Date.now() >= end) return failing
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
