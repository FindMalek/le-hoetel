import { CONSENT_COOKIE } from "@ritorno/compliance"
import { nextEnv } from "@ritorno/env/next"
import { cookies } from "next/headers"
import { UmamiScript } from "./umami-script"

export async function Umami() {
  const { NEXT_PUBLIC_UMAMI_URL: url, NEXT_PUBLIC_UMAMI_WEBSITE_ID: websiteId } = nextEnv()
  if (!websiteId) return null
  if ((await cookies()).get(CONSENT_COOKIE)?.value !== "granted") return null
  return <UmamiScript url={url} websiteId={websiteId} />
}
