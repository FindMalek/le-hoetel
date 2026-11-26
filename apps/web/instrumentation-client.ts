const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN

// The SDK is ~150 KB gzipped: load it only when error reporting is configured, and after the page is idle.
if (dsn) {
  const start = () => void import("@sentry/nextjs").then((Sentry) => Sentry.init({ dsn }))
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 4000 })
  else setTimeout(start, 2000)
}
