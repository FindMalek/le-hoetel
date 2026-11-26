import { captureUrl } from "@ritorno/common/qr"
import { NextResponse } from "next/server"
import { getShortLink } from "@/lib/api"

export const dynamic = "force-dynamic"

/** Temporary on purpose: a cached redirect would keep the old address after a hotel is renamed. */
const to = (location: string) =>
  new NextResponse(null, {
    status: 302,
    headers: { location, "cache-control": "no-store", "x-robots-tag": "noindex" },
  })

/** What every printed code opens: the hotel's capture page of today, with the same source and spot. */
export async function GET(request: Request, { params }: RouteContext<"/q/[code]">) {
  const { code } = await params
  const lang = new URL(request.url).searchParams.get("lang")
  const kept = new URLSearchParams(lang ? { lang } : {})
  try {
    const link = await getShortLink(code)
    if (!link) return to(`/q/invalid?${kept}`)
    const page = captureUrl("", link.slug, link.source, link.location)
    return to(lang ? `${page}&${kept}` : page)
  } catch {
    kept.set("retry", code)
    return to(`/q/invalid?${kept}`)
  }
}
