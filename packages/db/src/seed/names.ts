import type { DEMO_PHONE_RANGES } from "@ritorno/common/demo"
import type { HotelLanguage } from "@ritorno/common/hotel"

export type Origin = "tn" | "tn_ar" | "dz" | "fr" | "de" | "gb" | "it"

interface OriginData {
  first: string[]
  last: string[]
  language: HotelLanguage
  country: string
  cities: string[]
  /** A range no person holds, see `DEMO_PHONE_RANGES`. */
  phone: keyof typeof DEMO_PHONE_RANGES
}

export const ORIGINS: Record<Origin, OriginData> = {
  tn: {
    first:
      "Mohamed Ahmed Youssef Karim Slim Walid Sami Hichem Nizar Anis Aymen Bassem Chokri Fares Ghazi Mehdi Oussama Rami Seif Wassim Ines Sarra Mariem Rim Amel Yasmine Nour Salma Hela Meriem Asma Dorra Emna Farah Ghada Khaoula Lina Olfa Sirine Wafa".split(
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
      "Karoui",
      "Mabrouk",
      "Ncibi",
      "Rekik",
      "Slimane",
      "Tlili",
      "Ouertani",
      "Haddad",
    ],
    language: "fr",
    country: "Tunisia",
    cities: ["Tunis", "Sfax", "Sousse", "Nabeul", "Bizerte", "Gabès"],
    phone: "tn",
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
      "القروي",
      "الزواري",
      "بوزيد",
      "الشريف",
      "السالمي",
    ],
    language: "ar",
    country: "Tunisia",
    cities: ["Tunis", "Sfax", "Kairouan", "Gafsa", "Sousse"],
    phone: "tn",
  },
  dz: {
    first: "Amine Lilia Riad Samira Yacine Nadia Bilal Karima".split(" "),
    last: ["Benali", "Messaoudi", "Hadjadj", "Kaci", "Meziane", "Boukhari"],
    language: "fr",
    country: "Algeria",
    cities: ["Algiers", "Oran", "Constantine", "Annaba"],
    phone: "dz",
  },
  fr: {
    first:
      "Camille Lucas Léa Hugo Chloé Louis Manon Nathan Emma Julien Claire Thomas Sophie Antoine Élodie Mathieu Pauline Romain Aurélie Nicolas Céline Pierre".split(
        " ",
      ),
    last: "Martin Bernard Dubois Robert Richard Petit Durand Leroy Moreau Simon Laurent Lefebvre Michel Garcia Roux Fournier Girard Lambert Mercier Blanc".split(
      " ",
    ),
    language: "fr",
    country: "France",
    cities: ["Paris", "Lyon", "Marseille", "Toulouse", "Lille", "Nantes"],
    phone: "fiction",
  },
  de: {
    first: "Hans Anna Lukas Katharina Jonas Lena Felix Julia Tobias Sabine Markus Nina".split(" "),
    last: "Müller Schmidt Schneider Fischer Weber Becker Wagner Hoffmann Koch Richter Klein".split(" "),
    language: "en",
    country: "Germany",
    cities: ["Berlin", "Munich", "Hamburg", "Cologne"],
    phone: "de",
  },
  gb: {
    first: "Oliver Emily Harry Charlotte George Amelia Jack Grace Thomas Olivia James Sophie".split(" "),
    last: "Smith Jones Taylor Brown Wilson Evans Clarke Walker Hughes Green".split(" "),
    language: "en",
    country: "United Kingdom",
    cities: ["London", "Manchester", "Bristol", "Leeds"],
    phone: "fiction",
  },
  it: {
    first: "Marco Giulia Luca Francesca Matteo Chiara Andrea Sara".split(" "),
    last: "Rossi Russo Ferrari Esposito Bianchi Romano Colombo".split(" "),
    language: "en",
    country: "Italy",
    cities: ["Milan", "Rome", "Turin", "Naples"],
    phone: "fiction",
  },
}
