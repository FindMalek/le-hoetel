export const dynamic = "force-dynamic"

/** The deploy job waits for this to report the commit it deployed. */
export function GET() {
  return Response.json({ sha: process.env.GIT_SHA ?? null })
}
