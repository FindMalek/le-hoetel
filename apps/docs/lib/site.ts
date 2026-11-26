/** What the docs say about the project, in one place. */
export const SITE = {
  name: "Ritorno",
  /** Public origin, no trailing slash. Set DOCS_URL when deployed. */
  url: (process.env.DOCS_URL ?? "http://localhost:3003").replace(/\/$/, ""),
  tagline: "Loyalty and guest relationships for hotels in Tunisia",
  /** Repo url for the nav link, left empty until you have one. */
  github: "",
  /** Colors of the social card (opengraph-image), filled from the preset. Any hex works. */
  og: {
    background: "#ffffff",
    foreground: "#0b0b0c",
    muted: "#6b6b70",
    border: "#e4e4e2",
    accent: "#0a84ff",
  },
}
