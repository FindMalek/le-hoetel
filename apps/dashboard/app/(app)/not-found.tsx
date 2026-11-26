import { Button } from "@ritorno/ui/components/button"
import { PageState } from "@ritorno/ui/components/page-state"
import { CompassIcon } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

export default async function AppNotFound() {
  const t = await getTranslations("errorPages")
  return (
    <div className="p-4 pt-10 md:p-6 md:pt-16">
      <PageState
        kind="empty"
        icon={<CompassIcon />}
        title={<h1>{t("notFoundTitle")}</h1>}
        description={t("notFoundBody")}
        action={
          <Button render={<Link href="/" />} nativeButton={false}>
            {t("home")}
          </Button>
        }
      />
    </div>
  )
}
