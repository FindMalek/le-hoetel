import { nextEnv } from "@ritorno/env/next"

export const dynamic = "force-dynamic"

/** The deploy job waits for this to report the commit it deployed. */
export function GET() {
  return Response.json({ sha: nextEnv().GIT_SHA ?? null })
}
