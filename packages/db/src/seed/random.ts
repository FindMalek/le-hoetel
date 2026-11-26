/** mulberry32: a tiny seeded PRNG, so every preview gets the same data (only the dates move with "now"). */
export function random(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DAY = 864e5
export const HOUR = 36e5

/** The seeded draws every scenario file needs. */
export function dice(seed: number) {
  const rand = random(seed)
  const int = (max: number) => Math.floor(rand() * max)
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]!
  const chance = (p: number) => rand() < p
  const digits = (n: number) => Array.from({ length: n }, () => int(10)).join("")
  const uuid = () => {
    const hex = Array.from({ length: 32 }, () => int(16).toString(16))
    hex[12] = "4"
    hex[16] = "89ab"[int(4)]!
    const h = hex.join("")
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  }
  return { rand, int, pick, chance, digits, uuid }
}

/** A moment `daysBack` days ago at a plausible hour for a Tunisian hotel (08:00 to 22:00 local), never after `now`. */
export function momentAgo(now: Date, daysBack: number, rand: () => number): Date {
  const at = new Date(now.getTime() - daysBack * DAY)
  at.setUTCHours(7 + Math.floor(rand() * 14), Math.floor(rand() * 60), Math.floor(rand() * 60), 0)
  return at < now ? at : new Date(now.getTime() - Math.floor((1 + rand() * 90) * 60_000))
}

export const earlier = (now: Date, date: Date) => (date < now ? date : now)

export const day = (date: Date) => date.toISOString().slice(0, 10)
