export interface LocalTime {
  year: number
  /** 1 to 12. */
  month: number
  day: number
  /** 0 to 23. */
  hour: number
  /** `MM-DD`, how birthdays are compared. */
  monthDay: string
}

const pad = (n: number) => String(n).padStart(2, "0")

/** The wall clock in a hotel's timezone at one instant. Throws for an unknown timezone. */
export function localTime(now: Date, timeZone: string): LocalTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const [year, month, day, hour] = [get("year"), get("month"), get("day"), get("hour")] as [
    number,
    number,
    number,
    number,
  ]
  return { year, month, day, hour, monthDay: `${pad(month)}-${pad(day)}` }
}

export const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** Marketing is never sent from 21:00 to 08:00 hotel time. */
export const QUIET_HOURS = { from: 21, until: 8 } as const

export const isQuietHour = (hour: number): boolean => hour >= QUIET_HOURS.from || hour < QUIET_HOURS.until

/** Birthdays that are celebrated today. Someone born on 29 February is celebrated on 28 February in a year without one. */
export function birthdaysToday(local: LocalTime): string[] {
  const leapDay = local.monthDay === "02-28" && !isLeapYear(local.year)
  return leapDay ? ["02-28", "02-29"] : [local.monthDay]
}
