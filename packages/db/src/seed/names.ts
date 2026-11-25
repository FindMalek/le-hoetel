import type { HotelLanguage } from "@ritorno/common/hotel"

export type Origin = "tn" | "tn_ar" | "dz" | "fr" | "de" | "gb" | "it"

interface OriginData {
  first: string[]
  last: string[]
  language: HotelLanguage
  country: string
  cities: string[]
  phone: (digits: (n: number) => string, pick: (items: string) => string) => string
}

export const ORIGINS: Record<Origin, OriginData> = {
  tn: {
    first:
      "Mohamed Ahmed Youssef Karim Slim Walid Sami Hichem Nizar Anis Ines Sarra Mariem Rim Amel Yasmine Nour Salma Hela Meriem".split(
        " ",
      ),
    last: [
      "Ben Salah",
      "Trabelsi",
      "Jebali",
      "Gharbi",
      "Mejri",
      "Chebbi",
      "Hammami",
      "Ayari",
      "Khelifi",
      "Mansouri",
      "Sassi",
      "Dridi",
      "Zouari",
      "Belhaj",
      "Cherif",
      "Bouzid",
    ],
    language: "fr",
    country: "Tunisia",
    cities: ["Tunis", "Sfax", "Sousse", "Nabeul", "Bizerte", "Gabès"],
    phone: (d, p) => `+216${p("2459")}${d(7)}`,
  },
  tn_ar: {
    first: [
      "محمد",
      "أحمد",
      "يوسف",
      "كريم",
      "سليم",
      "وليد",
      "سامي",
      "هشام",
      "إيناس",
      "سارة",
      "مريم",
      "ريم",
      "أمل",
      "ياسمين",
      "نور",
      "سلمى",
      "هالة",
    ],
    last: [
      "بن صالح",
      "الطرابلسي",
      "الجبالي",
      "الغربي",
      "المجري",
      "الشابي",
      "الحمامي",
      "العياري",
      "الخليفي",
      "المنصوري",
      "الدريدي",
    ],
    language: "ar",
    country: "Tunisia",
    cities: ["Tunis", "Sfax", "Kairouan", "Gafsa", "Sousse"],
    phone: (d, p) => `+216${p("2459")}${d(7)}`,
  },
  dz: {
    first: "Amine Lilia Riad Samira Yacine Nadia Bilal Karima".split(" "),
    last: ["Benali", "Messaoudi", "Hadjadj", "Kaci", "Meziane", "Boukhari"],
    language: "fr",
    country: "Algeria",
    cities: ["Algiers", "Oran", "Constantine", "Annaba"],
    phone: (d, p) => `+213${p("567")}${d(8)}`,
  },
  fr: {
    first: "Camille Lucas Léa Hugo Chloé Louis Manon Nathan Emma Julien Claire Thomas Sophie Antoine".split(" "),
    last: "Martin Bernard Dubois Robert Richard Petit Durand Leroy Moreau Simon Laurent Lefebvre Michel".split(" "),
    language: "fr",
    country: "France",
    cities: ["Paris", "Lyon", "Marseille", "Toulouse", "Lille", "Nantes"],
    phone: (d, p) => `+33${p("6")}${d(8)}`,
  },
  de: {
    first: "Hans Anna Lukas Katharina Jonas Lena Felix Julia".split(" "),
    last: "Müller Schmidt Schneider Fischer Weber Becker Wagner".split(" "),
    language: "en",
    country: "Germany",
    cities: ["Berlin", "Munich", "Hamburg", "Cologne"],
    phone: (d, p) => `+4915${p("1257")}${d(8)}`,
  },
  gb: {
    first: "Oliver Emily Harry Charlotte George Amelia Jack Grace".split(" "),
    last: "Smith Jones Taylor Brown Wilson Evans Clarke".split(" "),
    language: "en",
    country: "United Kingdom",
    cities: ["London", "Manchester", "Bristol", "Leeds"],
    phone: (d, p) => `+447${p("4579")}${d(8)}`,
  },
  it: {
    first: "Marco Giulia Luca Francesca Matteo Chiara Andrea Sara".split(" "),
    last: "Rossi Russo Ferrari Esposito Bianchi Romano Colombo".split(" "),
    language: "en",
    country: "Italy",
    cities: ["Milan", "Rome", "Turin", "Naples"],
    phone: (d, p) => `+393${p("2349")}${p("0123456789")}${d(7)}`,
  },
}
