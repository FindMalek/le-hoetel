import { OpenAPIHandler } from "@orpc/openapi/fetch"
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins"
import { onError } from "@orpc/server"
import { RPCHandler } from "@orpc/server/fetch"
import { SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins"
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4"
import type { Auth } from "@ritorno/auth"
import { appRouter, clientIp, createContext, RATE_LIMITS, type Services } from "@ritorno/orpc"
import { linkTelegramChat } from "@ritorno/orpc/manager-alerts"
import { applyKapsoEvent, applyResendEvent, type KapsoPayload, type ResendEvent } from "@ritorno/orpc/messages"
import { handleInboundWhatsApp, unsubscribeAll } from "@ritorno/orpc/unsubscribe"
import { isPublicKey } from "@ritorno/storage"
import { verifyHmac, verifySvix } from "@ritorno/webhooks"
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
 *   /unsubscribe/<token>  POST: one tap unsubscribe from a mail client's List-Unsubscribe header (RFC 8058)
 *   /resend/webhook  Resend delivery, bounce and complaint events (svix signature checked)
 *   /whatsapp/webhook  Kapso status events and inbound messages, STOP replies included (signature header checked)
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
        docsTitle: "Ritorno API",
        schemaConverters: [new ZodToJsonSchemaConverter()],
        specGenerateOptions: {
          info: { title: "Ritorno API", version: "0.1.0" },
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
    if (pathname.startsWith("/unsubscribe/") && request.method === "POST") {
      const ip = clientIp(request.headers)
      if (ip && !(await services.rateLimiter.hit(`unsubscribe:${ip}`, RATE_LIMITS.default)).ok) {
        return Response.json({ ok: false }, { status: 429 })
      }
      const token = decodeURIComponent(pathname.slice("/unsubscribe/".length))
      const done = await unsubscribeAll(services, token).then(
        () => true,
        () => false,
      )
      return Response.json({ ok: done }, { status: done ? 200 : 404 })
    }
    if (pathname === "/resend/webhook" && request.method === "POST") {
      const secret = services.config.webhookSecrets?.resend
      if (!secret) return Response.json({ message: "Resend webhooks are not configured." }, { status: 404 })
      const body = await request.text()
      if (!verifySvix({ secret, headers: request.headers, body, now: services.now })) {
        return Response.json({ ok: false }, { status: 401 })
      }
      const event = JSON.parse(body) as ResendEvent
      await applyResendEvent(services.db, event)
      return Response.json({ ok: true })
    }
    if (pathname === "/whatsapp/webhook" && request.method === "POST") {
      const secret = services.config.webhookSecrets?.kapso
      if (!secret) return Response.json({ message: "WhatsApp webhooks are not configured." }, { status: 404 })
      const body = await request.text()
      const signature = request.headers.get("x-webhook-signature")
      if (!verifyHmac({ secret, body, signature })) return Response.json({ ok: false }, { status: 401 })
      const event = request.headers.get("x-webhook-event") ?? ""
      const parsed = JSON.parse(body) as KapsoPayload | { batch: true; data: KapsoPayload[] }
      for (const payload of "batch" in parsed ? parsed.data : [parsed]) {
        if (event === "whatsapp.message.received") await handleInboundWhatsApp(services, payload)
        else await applyKapsoEvent(services.db, event, payload)
      }
      return Response.json({ ok: true })
    }
    if (pathname === "/telegram/webhook" && request.method === "POST") {
      return services.notification.handleTelegramWebhook(request, (code, chatId) =>
        linkTelegramChat(services.db, code, chatId, services.now()),
      )
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
