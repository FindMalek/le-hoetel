import { PATHNAME_HEADER } from "@le-hoetel/i18n"
import { localeProxy } from "@le-hoetel/i18n/proxy"
import { type NextRequest, NextResponse } from "next/server"

export function proxy(request: NextRequest) {
  // The capture page picks its language from the hotel and `?lang=`, never from the site's locale cookie.
  if (request.nextUrl.pathname.startsWith("/h/")) {
    const headers = new Headers(request.headers)
    headers.set(PATHNAME_HEADER, request.nextUrl.pathname)
    return NextResponse.next({ request: { headers } })
  }
  return localeProxy(request)
}

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] }
