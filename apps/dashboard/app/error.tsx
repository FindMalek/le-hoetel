"use client"

import { Button } from "@le-hoetel/ui/components/button"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { ErrorScreen } from "@/components/error-screen"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPages")
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <ErrorScreen code="500" title={t("errorTitle")} body={t("errorBody")}>
      <Button size="lg" onClick={reset}>
        {t("retry")}
      </Button>
      <Button size="lg" variant="outline" render={<Link href="/" />} nativeButton={false}>
        {t("home")}
      </Button>
      {error.digest ? (
        <p className="basis-full pt-2 text-muted-foreground text-xs" dir="ltr">
          {t("reference", { digest: error.digest })}
        </p>
      ) : null}
    </ErrorScreen>
  )
}
