import type { Db } from "@ritorno/db"
import * as schema from "@ritorno/db/schema"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError } from "better-auth/api"
import { admin, magicLink } from "better-auth/plugins"
import { organization } from "better-auth/plugins/organization"
import { and, asc, eq, gt } from "drizzle-orm"
import { ac, hotelRoles } from "./access"
import { auditHooks } from "./audit"

export interface AuthConfig {
  db: Db
  secret: string
  /** Public url of the dashboard: auth is served under its `/api/auth` proxy, so cookies stay first-party. */
  dashboardUrl: string
  trustedOrigins: string[]
  github?: { clientId: string; clientSecret: string }
  secureCookies: boolean
  /** Called with the link to email; unset means those flows stay off. */
  sendVerification?: (user: { email: string; name: string }, url: string) => Promise<unknown>
  sendResetPassword?: (user: { email: string; name: string }, url: string) => Promise<unknown>
  sendMagicLink?: (email: string, url: string) => Promise<unknown>
  /** Called with the accept link of an organization invite; unset means the invite is only visible in the dashboard. */
  sendInvitation?: (invite: { email: string; inviter: string; role: string; url: string }) => Promise<unknown>
}

async function hasPendingInvitation(db: Db, email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.invitation.id })
    .from(schema.invitation)
    .where(
      and(
        eq(schema.invitation.email, email.toLowerCase()),
        eq(schema.invitation.status, "pending"),
        gt(schema.invitation.expiresAt, new Date()),
      ),
    )
    .limit(1)
  return Boolean(row)
}

const quiet = (task: Promise<unknown>) => task.catch((error) => console.error("[auth] email failed", error))

export function createAuth(config: AuthConfig) {
  const { sendVerification, sendResetPassword, sendMagicLink } = config
  const sendInvitation = config.sendInvitation
  const audit = auditHooks(config.db)
  return betterAuth({
    baseURL: config.dashboardUrl,
    // On in production by default with 3 sign-ins per 10s per ip, which locks out a hotel desk sharing one network
    // after a few typos. The api caps auth posts too (`RATE_LIMITS.auth`); reset and magic link emails keep the defaults.
    rateLimit: { customRules: { "/sign-in/*": { window: 60, max: 20 } } },
    hooks: audit.hooks,
    databaseHooks: {
      user: {
        create: {
          // No open sign up: over http only an invited email gets an account (any method: password, github, magic
          // link). Server calls (env admin, seed, tests) and the admin plugin's create-user carry no outside request.
          before: async (created, ctx) => {
            if (!ctx?.request || ctx.path === "/admin/create-user") return
            if (await hasPendingInvitation(config.db, created.email)) return
            throw new APIError("FORBIDDEN", { code: "INVITATION_REQUIRED", message: "Sign up is by invitation only." })
          },
        },
      },
      session: {
        create: {
          ...audit.databaseHooks.session.create,
          // Hotel users land in their hotel: the oldest membership is active from the first call.
          before: async (session) => {
            const [first] = await config.db
              .select({ organizationId: schema.member.organizationId })
              .from(schema.member)
              .where(eq(schema.member.userId, session.userId))
              .orderBy(asc(schema.member.createdAt))
              .limit(1)
            return { data: { ...session, activeOrganizationId: first?.organizationId ?? null } }
          },
        },
      },
    },
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(config.db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      sendResetPassword: sendResetPassword
        ? async ({ user, url }) => void quiet(sendResetPassword(user, url))
        : undefined,
    },
    emailVerification: sendVerification
      ? { sendOnSignUp: true, sendVerificationEmail: async ({ user, url }) => void quiet(sendVerification(user, url)) }
      : undefined,
    socialProviders: config.github ? { github: config.github } : undefined,
    plugins: [
      admin(),
      organization({
        ac,
        roles: hotelRoles,
        // A hotel is onboarded by the app admin (admin.hotels.create), never self-served.
        allowUserToCreateOrganization: (user) => user.role === "admin",
        // Deleting a hotel or changing its slug (printed on QR codes) or name only goes through the admin procedures.
        disableOrganizationDeletion: true,
        organizationHooks: {
          beforeUpdateOrganization: async ({ organization: patch }) => {
            if (patch.slug !== undefined || patch.name !== undefined) {
              throw new APIError("FORBIDDEN", { message: "Only the app admin can rename a hotel or change its slug." })
            }
          },
          afterCreateOrganization: async ({ organization: created }) => {
            await config.db
              .insert(schema.hotelSettings)
              .values({ organizationId: created.id, displayName: created.name })
              .onConflictDoNothing()
          },
        },
        sendInvitationEmail: sendInvitation
          ? async ({ id, email, role, inviter }) =>
              void quiet(
                sendInvitation({
                  email,
                  role: String(role),
                  inviter: inviter.user.name,
                  url: `${config.dashboardUrl}/accept-invitation/${id}`,
                }),
              )
          : undefined,
      }),
      ...(sendMagicLink
        ? [magicLink({ sendMagicLink: async ({ email, url }) => void quiet(sendMagicLink(email, url)) })]
        : []),
    ],
    advanced: {
      useSecureCookies: config.secureCookies,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  })
}

export type Auth = ReturnType<typeof createAuth>
export type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>
