import { LoadingState } from "@ritorno/ui/components/loading-state"
import { Skeleton } from "@ritorno/ui/components/skeleton"
import { getTranslations } from "next-intl/server"

/** Same frame as `GuestShell`, before the hotel is known: no colors, no name, just the shape of the page. */
export default async function GuestLoading() {
  const t = await getTranslations("guest")
  return (
    <div className="flex min-h-dvh flex-col bg-background md:bg-surface md:px-6 md:py-12">
      <LoadingState
        label={t("loading")}
        className="mx-auto w-full md:max-w-lg md:overflow-hidden md:rounded-panel md:border md:bg-background"
      >
        <div className="flex flex-col items-center gap-3 border-b bg-surface px-5 pt-20 pb-7">
          <Skeleton className="size-16 rounded-2xl bg-background" />
          <Skeleton className="h-7 w-40 bg-background" />
          <Skeleton className="h-4 w-56 bg-background" />
        </div>
        <div className="grid gap-6 px-5 pt-6 pb-10">
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-12 rounded-input" />
          <Skeleton className="h-12 rounded-input" />
          <Skeleton className="h-12 rounded-full" />
        </div>
      </LoadingState>
    </div>
  )
}
