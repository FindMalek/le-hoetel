import { PATHNAME_HEADER } from "@ritorno/i18n"
import { localeProxy } from "@ritorno/i18n/proxy"
import { type NextRequest, NextResponse } from "next/server"

const GUEST_PATHS = ["/h/", "/q/", "/u/", "/s/", "/o/", "/r/"]

export function proxy(request: NextRequest) {
  // Guest pages pick their language from the hotel, the guest and `?lang=`, never from the site's locale cookie.
  if (GUEST_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))) {
    const headers = new Headers(request.headers)
    headers.set(PATHNAME_HEADER, request.nextUrl.pathname)
    return NextResponse.next({ request: { headers } })
  }
  return localeProxy(request)
}

/** `/u/`, `/s/`, `/o/` and `/r/` carry a signed token with a dot in it, which the generic matcher would read as a file, with or without a language prefix. */
export const config = {
  matcher: [
    "/((?!api|_next|.*\\..*).*)",
    "/u/:path*",
    "/s/:path*",
    "/o/:path*",
    "/r/:path*",
    "/(fr|ar)/(u|s|o|r)/:path*",
  ],
}
