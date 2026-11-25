import { Skeleton } from "@ritorno/ui/components/skeleton"
import { getTranslations } from "next-intl/server"

export default async function Loading() {
  const t = await getTranslations("shell")
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-8 p-4 md:p-6 md:pt-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <Skeleton className="h-32 w-full max-w-sm" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  )
}
