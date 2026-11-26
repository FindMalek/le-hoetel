import { NextResponse } from "next/server"
import { getReviewUrl } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: RouteContext<"/r/[token]">) {
  const { token } = await params
  const review = await getReviewUrl(token)
  if (!review) {
    const location = `/r/invalid${new URL(request.url).search}`
    return new NextResponse(null, { status: 302, headers: { location, "x-robots-tag": "noindex" } })
  }
  return NextResponse.redirect(review.url, { status: 302, headers: { "x-robots-tag": "noindex" } })
}
