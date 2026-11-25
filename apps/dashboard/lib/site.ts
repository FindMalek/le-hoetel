/** What the dashboard says about itself in titles and link previews. */
export const SITE = {
  name: "Ritorno",
  tagline: "Loyalty and guest relationships for hotels in Tunisia",
  /** Colors of the social card (opengraph-image), filled from the preset. Any hex works. */
  og: {
    background: "#0a0a0a",
    foreground: "#fafafa",
    muted: "#a1a1a1",
    border: "#232323",
    accent: "#e5e5e5",
  },
}

/** The dashboard origin, read per request so one build serves every environment. */
export function dashboardUrl(): string {
  return (process.env.DASHBOARD_URL ?? "http://localhost:3002").replace(/\/$/, "")
}
