import { PageState } from "@ritorno/ui/components/page-state"
import { Skeleton } from "@ritorno/ui/components/skeleton"
import { getTranslations } from "next-intl/server"

export default async function Loading() {
  const t = await getTranslations("shell")
  return (
    <div className="flex flex-col gap-8 px-4 pt-6 pb-4 md:px-6 md:pt-8 md:pb-6">
      <div aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-9 w-56 max-w-full" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <PageState kind="loading" label={t("loading")} />
    </div>
  )
}
