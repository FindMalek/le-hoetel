/** Fake accounts of the seeded demo. Harmless domain, never deliverable. Password: env `DEMO_PASSWORD`, else the default below. */
export const DEMO_EMAIL_DOMAIN = "demo.ritorno.test"
export const DEFAULT_DEMO_PASSWORD = "demo-ritorno-2026"

export const DEMO_SUPER_ADMIN_EMAIL = `admin@${DEMO_EMAIL_DOMAIN}`

/**
 * The account to hand around in a sales meeting: a member of one demo hotel that can look but not change anything.
 * The api and auth refuse its writes, so a prospect holding the phone can't break the demo. Only the seed creates it.
 */
export const DEMO_VIEWER_EMAIL = `sales@${DEMO_EMAIL_DOMAIN}`

export function isDemoViewer(email: string): boolean {
  return email.toLowerCase() === DEMO_VIEWER_EMAIL
}

export const DEMO_HOTEL_SLUGS = ["dar-zitouna", "sunset-bay", "villa-mimosa", "riad-dattier"] as const
export type DemoHotelSlug = (typeof DEMO_HOTEL_SLUGS)[number]

export function demoOwnerEmail(slug: DemoHotelSlug): string {
  return `owner.${slug}@${DEMO_EMAIL_DOMAIN}`
}

/**
 * Phone ranges of the seeded demo, none of which can ring a person. `+33 6 39 98` is the range ARCEP (France) reserves
 * for fiction. The other three are blocks no operator holds according to libphonenumber's allocation data (not an
 * official reservation): `+216 49`, `+213 500` and `+49 1530`. All pass the app's phone validation.
 */
export const DEMO_PHONE_RANGES = {
  fiction: { prefix: "+3363998", digits: 4 },
  tn: { prefix: "+21649", digits: 6 },
  dz: { prefix: "+213500", digits: 6 },
  de: { prefix: "+491530", digits: 7 },
} as const

/** True for a seeded demo address or number: the notifier never hands one to a provider, even when messaging is live. */
export function isDemoRecipient(to: string): boolean {
  const value = to.trim().toLowerCase()
  if (value.startsWith("+")) return Object.values(DEMO_PHONE_RANGES).some((range) => value.startsWith(range.prefix))
  return value.endsWith(`@${DEMO_EMAIL_DOMAIN}`) || value.endsWith(`.${DEMO_EMAIL_DOMAIN}`)
}
