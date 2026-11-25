/** Fake accounts of the seeded demo. Harmless domain, never deliverable. Password: env `DEMO_PASSWORD`, else the default below. */
export const DEMO_EMAIL_DOMAIN = "demo.ritorno.test"
export const DEFAULT_DEMO_PASSWORD = "demo-ritorno-2026"

export const DEMO_SUPER_ADMIN_EMAIL = `admin@${DEMO_EMAIL_DOMAIN}`

export const DEMO_HOTEL_SLUGS = ["dar-zitouna", "sunset-bay", "villa-mimosa", "riad-dattier"] as const
export type DemoHotelSlug = (typeof DEMO_HOTEL_SLUGS)[number]

export function demoOwnerEmail(slug: DemoHotelSlug): string {
  return `owner.${slug}@${DEMO_EMAIL_DOMAIN}`
}
