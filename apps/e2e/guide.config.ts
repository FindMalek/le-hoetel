import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"
import { BASE_DATABASE_URL } from "./env"
import { GUIDE_DATABASE, guideDatabaseUrl, URLS } from "./guide/env"

const shared = {
  API_URL: URLS.api,
  API_PUBLIC_URL: URLS.api,
  WEB_URL: URLS.web,
  DASHBOARD_URL: URLS.dashboard,
  // A root .env must not reach a provider, analytics or error tracker from here.
  MESSAGING_LIVE: "false",
  RESEND_API_KEY: "",
  KAPSO_API_KEY: "",
  WHATSAPP_BUSINESS_NUMBER: "",
  S3_ENDPOINT: "",
  NEXT_PUBLIC_UMAMI_URL: "",
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: "",
  GLITCHTIP_DSN: "",
  NEXT_PUBLIC_GLITCHTIP_DSN: "",
  OPENOBSERVE_URL: "",
}
const port = (url: string) => new URL(url).port
// GUIDE_REUSE=1 shoots against servers you already run on these ports, without a fresh database.
const reuseExistingServer = process.env.GUIDE_REUSE === "1"
const app = (name: "web" | "dashboard") => ({
  command: `pnpm --filter ${name} exec next build && pnpm --filter ${name} exec next start --port ${port(URLS[name])}`,
  timeout: 10 * 60_000,
  reuseExistingServer,
  env: shared,
})

/** `pnpm guide:shots`: the screenshots of the hotel staff guide, from a freshly seeded demo database. */
export default defineConfig({
  testDir: "./guide",
  testMatch: "*.shots.ts",
  outputDir: fileURLToPath(new URL("./test-results/guide", import.meta.url)),
  workers: 1,
  timeout: 3 * 60_000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    locale: "en-GB",
    timezoneId: "Africa/Tunis",
    colorScheme: "light",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: [
    {
      command: "bun prepare-db.ts && cd ../api && bun src/index.ts",
      url: `${URLS.api}/health`,
      timeout: 120_000,
      reuseExistingServer,
      env: {
        ...shared,
        E2E_DATABASE_URL: BASE_DATABASE_URL,
        E2E_DATABASE_NAME: GUIDE_DATABASE,
        DATABASE_URL: guideDatabaseUrl(),
        BETTER_AUTH_SECRET: "guide-secret-guide-secret-guide-secret-01",
        PORT: port(URLS.api),
        SEED: "demo",
        DEPLOY_ENV: "e2e",
      },
    },
    { ...app("web"), url: URLS.web },
    { ...app("dashboard"), url: `${URLS.dashboard}/sign-in` },
  ],
})
