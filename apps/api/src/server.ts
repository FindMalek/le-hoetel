import type { Auth } from "@le-hoetel/auth"
import { appRouter, createContext, type Services } from "@le-hoetel/orpc"
import { isPublicKey } from "@le-hoetel/storage"
import { OpenAPIHandler } from "@orpc/openapi/fetch"
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins"
import { onError } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fetch"
import { SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins"
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4"
import * as Sentry from "@sentry/bun"
import { sql } from "drizzle-orm"
import { withSecurityHeaders } from "./headers"
import { withRequestLogging } from "./logger"
import { traceCall } from "./openobserve"
import { limitAuth } from "./rate-limit"

export type Handler = (request: Request) => Promise<Response>

type Interceptors = NonNullable<NonNullable<ConstructorParameters<typeof RPCHandler>[1]>["interceptors"]>

/**
 * The api is the only app that touches the database, auth, storage and providers. Routes:
 *   /auth/*       better-auth (sign-in posts are rate limited per ip; the dashboard proxies /api/auth/* here, so cookies stay first-party)
 *   /rpc/*        oRPC for web + dashboard (needs `x-csrf-token: orpc`)
 *   /v1/*         the same procedures as REST, docs at /v1/docs, spec at /v1/openapi.json
 *   /files/<key>  redirect to a short-lived url for an uploaded file
 *   /billing/webhook  Stripe or Polar events (signature checked)
 *   /telegram/webhook  Telegram bot updates (secret header checked)
 *   /health       for Dokploy and uptime checks
 */
export function createServer(services: Services & { auth: Auth }, opts: { publicUrl: string }) {
  const interceptors: Interceptors = []
  interceptors.push(onError((error) => void Sentry.captureException(error)))
  interceptors.push(traceCall)
  const wrappers: Array<(next: Handler) => Handler> = []
  wrappers.push(withRequestLogging)
  const rpc = new RPCHandler(appRouter, { plugins: [new SimpleCsrfProtectionHandlerPlugin()], interceptors })
  const rest = new OpenAPIHandler(appRouter, {
    interceptors,
    plugins: [
      new OpenAPIReferencePlugin({
        docsPath: "/docs",
        specPath: "/openapi.json",
        docsTitle: "Le Hoetel API",
        schemaConverters: [new ZodToJsonSchemaConverter()],
        specGenerateOptions: {
          info: { title: "Le Hoetel API", version: "0.1.0" },
          servers: [{ url: `${opts.publicUrl}/v1` }],
        },
      }),
    ],
  })

  async function handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === "/" || pathname === "/docs") return Response.redirect(new URL("/v1/docs", request.url), 302)
    if (pathname.startsWith("/auth/")) {
      const limited = await limitAuth(services, request)
      if (limited) return limited
      // The proxy strips the app's `/api` prefix; better-auth expects its default `/api/auth` base path back.
      const url = new URL(request.url)
      url.pathname = `/api${pathname}`
      return services.auth.handler(new Request(url, request))
    }
    if (pathname === "/health") {
      const db = await services.db
        .execute(sql`select 1`)
        .then(() => true)
        .catch(() => false)
      return Response.json({ ok: db, db, env: services.config.deployEnv }, { status: db ? 200 : 503 })
    }
    if (pathname === "/telegram/webhook" && request.method === "POST") {
      return services.notification.handleTelegramWebhook(request)
    }
    if (pathname.startsWith("/files/")) {
      if (!services.storage) return Response.json({ message: "Storage is not configured." }, { status: 404 })
      const key = decodeURIComponent(pathname.slice("/files/".length))
      if (!isPublicKey(services.storage, key)) return Response.json({ message: "Not found." }, { status: 404 })
      const location = services.storage.url(key)
      return new Response(null, { status: 302, headers: { location, "cache-control": "public, max-age=3000" } })
    }

    const context = await createContext(services, request.headers)
    const viaRpc = await rpc.handle(request, { prefix: "/rpc", context })
    if (viaRpc.matched) return viaRpc.response
    const viaRest = await rest.handle(request, { prefix: "/v1", context })
    if (viaRest.matched) return viaRest.response
    return Response.json({ message: "Not found." }, { status: 404 })
  }

  const https = opts.publicUrl.startsWith("https://")
  const handler = wrappers.reduceRight<Handler>((next, wrap) => wrap(next), handle)
  return async function fetch(request: Request): Promise<Response> {
    return withSecurityHeaders(await handler(request), { https })
  }
}
