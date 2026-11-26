import { createStorage } from "@ritorno/storage"
import { hashPassword } from "better-auth/crypto"
import { createDb } from "./index"
import { assertSeedable, seedDemo } from "./seed/index"

const { DATABASE_URL, DEPLOY_ENV, DEMO_PASSWORD, WEB_URL, API_PUBLIC_URL, S3_PREFIX } = process.env
// Before anything connects, so a production url is never even opened.
assertSeedable({ deployEnv: DEPLOY_ENV, databaseUrl: DATABASE_URL! })
const db = createDb(DATABASE_URL!)
const storage = createStorage({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "auto",
  bucket: process.env.S3_BUCKET,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  prefix: S3_PREFIX ?? "",
})
const seeded = await seedDemo(db, {
  hashPassword,
  demoPassword: DEMO_PASSWORD,
  deployEnv: DEPLOY_ENV,
  databaseUrl: DATABASE_URL!,
  storage,
  webUrl: WEB_URL,
  apiUrl: API_PUBLIC_URL,
})
console.info(seeded ? "seeded" : "database not empty, nothing seeded")
await db.close()
