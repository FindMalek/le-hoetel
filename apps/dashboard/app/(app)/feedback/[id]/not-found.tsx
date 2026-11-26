import { Button } from "@ritorno/ui/components/button"
import { PageState } from "@ritorno/ui/components/page-state"
import { CompassIcon } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { call } from "@/lib/api"

/** The alert email links here whatever hotel is active, so say which one was searched. */
export default async function CaseNotFound() {
  const [t, hotel] = await Promise.all([
    getTranslations("feedbackCases"),
    call((api) => api.hotel.get()).catch(() => null),
  ])
  return (
    <div className="p-4 pt-10 md:p-6 md:pt-16">
      <PageState
        kind="empty"
        icon={<CompassIcon />}
        title={<h1>{t("notFoundTitle")}</h1>}
        description={t("notFoundBody", { hotel: `⁨${hotel?.displayName ?? ""}⁩` })}
        action={
          <Button render={<Link href="/feedback" />} nativeButton={false}>
            {t("backToList")}
          </Button>
        }
      />
    </div>
  )
}
