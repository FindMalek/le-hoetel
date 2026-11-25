import type { HotelLanguage } from "./hotel"

export const HOLIDAY_KEYS = [
  "ramadan_start",
  "eid_al_fitr",
  "eid_al_adha",
  "mawlid",
  "independence_day",
  "republic_day",
  "new_year",
] as const
export type HolidayKey = (typeof HOLIDAY_KEYS)[number]

export const HOLIDAY_CHANNELS = ["both", "email", "whatsapp"] as const
export type HolidayChannel = (typeof HOLIDAY_CHANNELS)[number]

interface HolidayText {
  /** The greeting, also the name shown in the dashboard. */
  name: string
  /** `{hotel}` is the hotel's display name. */
  body: string
}

interface Holiday {
  /** `MM-DD` for a fixed date. Islamic holidays have none and read `ISLAMIC_DATES`. */
  fixed?: string
  text: Record<HotelLanguage, HolidayText>
}

export const HOLIDAYS: Record<HolidayKey, Holiday> = {
  ramadan_start: {
    text: {
      en: { name: "Ramadan Mubarak", body: "Everyone at {hotel} wishes you a blessed and peaceful Ramadan." },
      fr: {
        name: "Ramadan Moubarak",
        body: "Toute l'équipe de {hotel} vous souhaite un Ramadan béni et plein de paix.",
      },
      ar: { name: "رمضان مبارك", body: "يتمنى لكم جميع العاملين في {hotel} شهر رمضان مبارك وسلام." },
    },
  },
  eid_al_fitr: {
    text: {
      en: { name: "Eid Mubarak", body: "Everyone at {hotel} wishes you and your family a joyful Eid al-Fitr." },
      fr: {
        name: "Aïd Moubarak",
        body: "Toute l'équipe de {hotel} vous souhaite, à vous et à votre famille, un joyeux Aïd el-Fitr.",
      },
      ar: { name: "عيد فطر مبارك", body: "يتمنى لكم ولعائلتكم جميع العاملين في {hotel} عيد فطر سعيداً." },
    },
  },
  eid_al_adha: {
    text: {
      en: {
        name: "Eid al-Adha Mubarak",
        body: "Everyone at {hotel} wishes you and your family a blessed Eid al-Adha.",
      },
      fr: {
        name: "Aïd el-Idha Moubarak",
        body: "Toute l'équipe de {hotel} vous souhaite, à vous et à votre famille, un Aïd el-Idha béni.",
      },
      ar: { name: "عيد أضحى مبارك", body: "يتمنى لكم ولعائلتكم جميع العاملين في {hotel} عيد أضحى مبارك." },
    },
  },
  mawlid: {
    text: {
      en: { name: "Happy Mawlid", body: "Everyone at {hotel} wishes you a blessed Mawlid." },
      fr: { name: "Bon Mouled", body: "Toute l'équipe de {hotel} vous souhaite un Mouled béni." },
      ar: { name: "مولد نبوي مبارك", body: "يتمنى لكم جميع العاملين في {hotel} مولداً نبوياً مباركاً." },
    },
  },
  independence_day: {
    fixed: "03-20",
    text: {
      en: { name: "Happy Independence Day", body: "Everyone at {hotel} wishes you a happy Independence Day." },
      fr: {
        name: "Bonne fête de l'Indépendance",
        body: "Toute l'équipe de {hotel} vous souhaite une belle fête de l'Indépendance.",
      },
      ar: { name: "عيد الاستقلال مبارك", body: "يتمنى لكم جميع العاملين في {hotel} عيد استقلال سعيداً." },
    },
  },
  republic_day: {
    fixed: "07-25",
    text: {
      en: { name: "Happy Republic Day", body: "Everyone at {hotel} wishes you a happy Republic Day." },
      fr: {
        name: "Bonne fête de la République",
        body: "Toute l'équipe de {hotel} vous souhaite une belle fête de la République.",
      },
      ar: { name: "عيد الجمهورية مبارك", body: "يتمنى لكم جميع العاملين في {hotel} عيد جمهورية سعيداً." },
    },
  },
  new_year: {
    fixed: "01-01",
    text: {
      en: { name: "Happy New Year", body: "Everyone at {hotel} wishes you a happy and healthy new year." },
      fr: {
        name: "Bonne année",
        body: "Toute l'équipe de {hotel} vous souhaite une année heureuse et en bonne santé.",
      },
      ar: { name: "سنة سعيدة", body: "يتمنى لكم جميع العاملين في {hotel} سنة جديدة سعيدة وصحة جيدة." },
    },
  },
}

/**
 * Gregorian dates of the Islamic holidays (Umm al-Qura calendar), written down so nothing needs the network.
 * The moon is sighted locally, so Tunisia can be a day off: the hotel sees the date in the dashboard.
 * A year after `ISLAMIC_DATES_UNTIL` the Islamic holidays stop firing until this table is extended (a test fails first).
 */
export const ISLAMIC_DATES: Record<
  Extract<HolidayKey, "ramadan_start" | "eid_al_fitr" | "eid_al_adha" | "mawlid">,
  string[]
> = {
  ramadan_start: [
    "2026-02-18",
    "2027-02-08",
    "2028-01-28",
    "2029-01-16",
    "2030-01-05",
    "2030-12-26",
    "2031-12-16",
    "2032-12-04",
    "2033-11-23",
    "2034-11-12",
    "2035-11-01",
  ],
  eid_al_fitr: [
    "2026-03-20",
    "2027-03-09",
    "2028-02-26",
    "2029-02-14",
    "2030-02-04",
    "2031-01-24",
    "2032-01-14",
    "2033-01-03",
    "2033-12-23",
    "2034-12-12",
    "2035-12-01",
  ],
  eid_al_adha: [
    "2026-05-27",
    "2027-05-16",
    "2028-05-05",
    "2029-04-24",
    "2030-04-13",
    "2031-04-02",
    "2032-03-22",
    "2033-03-12",
    "2034-03-01",
    "2035-02-19",
  ],
  mawlid: [
    "2026-08-25",
    "2027-08-14",
    "2028-08-03",
    "2029-07-24",
    "2030-07-13",
    "2031-07-02",
    "2032-06-20",
    "2033-06-10",
    "2034-05-30",
    "2035-05-20",
  ],
}
export const ISLAMIC_DATES_UNTIL = 2035

/** The holidays that fall on a day, `YYYY-MM-DD` in the hotel's timezone. Eid al-Fitr and Independence Day can share one. */
export function holidaysOn(date: string): HolidayKey[] {
  return HOLIDAY_KEYS.filter((key) => {
    const holiday = HOLIDAYS[key]
    if (holiday.fixed) return date.slice(5) === holiday.fixed
    return ISLAMIC_DATES[key as keyof typeof ISLAMIC_DATES].includes(date)
  })
}

/** The next date of a holiday on or after `from` (`YYYY-MM-DD`), or null past the table. For the dashboard. */
export function nextHolidayDate(key: HolidayKey, from: string): string | null {
  const holiday = HOLIDAYS[key]
  if (!holiday.fixed) return ISLAMIC_DATES[key as keyof typeof ISLAMIC_DATES].find((date) => date >= from) ?? null
  const year = Number(from.slice(0, 4))
  const thisYear = `${year}-${holiday.fixed}`
  return thisYear >= from ? thisYear : `${year + 1}-${holiday.fixed}`
}
