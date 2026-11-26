import type { Db } from "@ritorno/db"
import { type SeedOptions, seedDemo, seedRefusal } from "@ritorno/db/seed"

/** `SEED=demo` on api start: a target the demo must not touch is skipped with a warning, the api still boots. */
export async function seedOnBoot(db: Db, opts: SeedOptions): Promise<void> {
  const refusal = seedRefusal(opts)
  if (refusal) console.warn(refusal)
  else if (await seedDemo(db, opts)) console.info("seeded demo data")
}
