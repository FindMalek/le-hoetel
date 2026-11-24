import { Cairo, Inter, JetBrains_Mono } from "next/font/google"

const latin = Inter({ subsets: ["latin"], display: "swap", variable: "--font-latin" })
const arabic = Cairo({ subsets: ["arabic"], display: "swap", preload: false, variable: "--font-arabic" })
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-mono" })

export const fontVariables = [latin.variable, arabic.variable, mono.variable].join(" ")
