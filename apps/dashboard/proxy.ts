import { type NextRequest, NextResponse } from "next/server"

/** Optimistic check only (no cookie → sign-in); the api validates the session on every call. */
export function proxy(request: NextRequest) {
  const signedIn =
    request.cookies.has("better-auth.session_token") || request.cookies.has("__Secure-better-auth.session_token")
  if (signedIn) return NextResponse.next()
  const url = new URL("/sign-in", request.url)
  const { pathname, search } = request.nextUrl
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!sign-in|sign-up|forgot-password|reset-password|api|_next|icon.svg|opengraph-image|robots.txt).*)"],
}
