/** What the dashboard says about itself in titles and link previews. */
export const SITE = {
  name: "Ritorno",
  tagline: "Loyalty and guest relationships for hotels in Tunisia",
  /** Colors of the social card (opengraph-image), filled from the preset. Any hex works. */
  og: {
    background: "#ffffff",
    foreground: "#0b0b0c",
    muted: "#6b6b70",
    border: "#e4e4e2",
    accent: "#0a84ff",
  },
}

/** The dashboard origin, read per request so one build serves every environment. */
export function dashboardUrl(): string {
  return (process.env.DASHBOARD_URL ?? "http://localhost:3002").replace(/\/$/, "")
}
