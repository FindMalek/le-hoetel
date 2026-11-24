import { CONSENT_COOKIE } from "@le-hoetel/compliance"
import { nextEnv } from "@le-hoetel/env/next"
import { cookies } from "next/headers"
import Script from "next/script"

export async function Umami() {
  const { NEXT_PUBLIC_UMAMI_URL: url, NEXT_PUBLIC_UMAMI_WEBSITE_ID: websiteId } = nextEnv()
  if (!websiteId) return null
  if ((await cookies()).get(CONSENT_COOKIE)?.value !== "granted") return null
  return <Script src={`${url}/script.js`} data-website-id={websiteId} strategy="afterInteractive" />
}
