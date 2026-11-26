import { Geist, Geist_Mono, Newsreader, Noto_Naskh_Arabic, Noto_Sans_Arabic } from "next/font/google"

// Variable names stay off Tailwind's --font-* theme keys, which globals.css builds from them per language.
const sans = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" })
const mono = Geist_Mono({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-geist-mono" })
const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  style: ["italic"],
  axes: ["opsz"],
  display: "swap",
  preload: true,
  variable: "--font-newsreader",
})
const arabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-arabic",
})
const arabicSerif = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  display: "swap",
  preload: false,
  variable: "--font-noto-naskh-arabic",
})

export const fontVariables = [sans, mono, serif, arabic, arabicSerif].map((font) => font.variable).join(" ")
