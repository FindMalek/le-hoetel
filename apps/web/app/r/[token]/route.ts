import { NextResponse } from "next/server"
import { getReviewUrl } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: RouteContext<"/r/[token]">) {
  const { token } = await params
  const review = await getReviewUrl(token)
  if (!review) return new NextResponse("Not found", { status: 404, headers: { "x-robots-tag": "noindex" } })
  return NextResponse.redirect(review.url, { status: 302, headers: { "x-robots-tag": "noindex" } })
}
