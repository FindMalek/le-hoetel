import type { Db } from "@le-hoetel/db"
import * as schema from "@le-hoetel/db/schema"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, magicLink } from "better-auth/plugins"
import { organization } from "better-auth/plugins/organization"
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

const quiet = (task: Promise<unknown>) => task.catch((error) => console.error("[auth] email failed", error))

export function createAuth(config: AuthConfig) {
  const { sendVerification, sendResetPassword, sendMagicLink } = config
  const sendInvitation = config.sendInvitation
  return betterAuth({
    baseURL: config.dashboardUrl,
    ...auditHooks(config.db),
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
        organizationHooks: {
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
