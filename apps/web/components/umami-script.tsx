"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"

const PUBLIC_PATHS = ["/", "/privacy", "/terms", "/status"]

export function UmamiScript({ url, websiteId }: { url: string; websiteId: string }) {
  const pathname = usePathname()
  if (!PUBLIC_PATHS.includes(pathname)) return null
  return (
    <Script
      src={`${url}/script.js`}
      data-website-id={websiteId}
      data-do-not-track="true"
      data-exclude-search="true"
      strategy="afterInteractive"
    />
  )
}
