import type { ApiEnv } from "@ritorno/env/api"
import type { Services } from "@ritorno/orpc"

export const serviceConfig = (env: ApiEnv): Services["config"] => ({
  deployEnv: env.DEPLOY_ENV,
  gitSha: env.GIT_SHA,
  githubAuth: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  githubRepo: env.GITHUB_REPO,
  githubToken: env.GITHUB_TOKEN,
  webUrl: env.WEB_URL,
  dashboardUrl: env.DASHBOARD_URL,
  apiUrl: env.API_PUBLIC_URL,
  tokenSecret: env.BETTER_AUTH_SECRET,
  leadsEmail: env.LEADS_NOTIFY_EMAIL ?? env.ADMIN_EMAIL,
  whatsappNumber: env.WHATSAPP_BUSINESS_NUMBER || undefined,
  webhookSecrets: { resend: env.RESEND_WEBHOOK_SECRET, kapso: env.KAPSO_WEBHOOK_SECRET },
})
