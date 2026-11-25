import { Button } from "@le-hoetel/ui/components/button"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ErrorScreen } from "@/components/error-screen"

export default async function NotFound() {
  const t = await getTranslations("errorPages")
  return (
    <ErrorScreen code="404" title={t("notFoundTitle")} body={t("notFoundBody")}>
      <Button size="lg" render={<Link href="/" />} nativeButton={false}>
        {t("home")}
      </Button>
    </ErrorScreen>
  )
}
