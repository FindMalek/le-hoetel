import { CardSkeleton } from "@ritorno/ui/components/loading-state"
import { getTranslations } from "next-intl/server"

export default async function Loading() {
  const t = await getTranslations("feedbackCases")
  return (
    <div className="grid gap-8 p-4 md:p-6 lg:grid-cols-2 lg:gap-14">
      <CardSkeleton label={t("loadingCase")} />
      <CardSkeleton label={t("loadingCase")} />
    </div>
  )
}
