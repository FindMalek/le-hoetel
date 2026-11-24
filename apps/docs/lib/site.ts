/** What the docs say about the project, in one place. */
export const SITE = {
  name: "le-hoetel",
  /** Public origin, no trailing slash. Set DOCS_URL when deployed. */
  url: (process.env.DOCS_URL ?? "http://localhost:3003").replace(/\/$/, ""),
  tagline: "Loyalty and guest relationships for hotels in Tunisia",
  /** Repo url for the nav link, left empty until you have one. */
  github: "",
  /** Colors of the social card (opengraph-image), filled from the preset. Any hex works. */
  og: {
    background: "#0a0a0a",
    foreground: "#fafafa",
    muted: "#a1a1a1",
    border: "#232323",
    accent: "#e5e5e5",
  },
}
