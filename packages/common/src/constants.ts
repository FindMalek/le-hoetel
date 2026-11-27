export const NOTE_TITLE_MAX = 120
export const NOTE_BODY_MAX = 10_000
export const PROFILE_NAME_MAX = 80
export const ADMIN_LIST_LIMIT = 100
/** HMAC context of guest links (unsubscribe, survey, offer). Changing it voids every link already sent. */
export const TOKEN_NAMESPACE = "ritorno"

/** Request header carrying the invitation a sign up came from: auth refuses a password sign up without it. */
export const INVITATION_ID_HEADER = "x-invitation-id"
