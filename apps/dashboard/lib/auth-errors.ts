export type AuthErrorKey = "invalidCredentials" | "exists" | "tooMany" | "generic" | "passwordShort" | "notInvited"

interface AuthApiError {
  status?: number
  code?: string
}

/** Maps a better-auth client error to one of our translated messages. */
export function authErrorKey(error: AuthApiError): AuthErrorKey {
  if (error.status === 429) return "tooMany"
  if (error.code === "INVALID_EMAIL_OR_PASSWORD") return "invalidCredentials"
  if (error.code?.startsWith("USER_ALREADY_EXISTS")) return "exists"
  if (error.code === "PASSWORD_TOO_SHORT") return "passwordShort"
  if (error.code === "INVITATION_REQUIRED") return "notInvited"
  if (error.status === 401) return "invalidCredentials"
  return "generic"
}
