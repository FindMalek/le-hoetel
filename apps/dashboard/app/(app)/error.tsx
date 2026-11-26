"use client"

import { Button } from "@ritorno/ui/components/button"
import { PageState } from "@ritorno/ui/components/page-state"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { PageHeader } from "@/components/page-header"

/** Any page that throws lands here inside the shell, so the sidebar and tabs stay usable. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("errorPages")
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <>
      <PageHeader title={t("errorTitle")} />
      <div className="flex flex-col gap-3 p-4 md:p-6">
        <PageState
          kind="error"
          title={t("errorBody")}
          action={
            <Button variant="outline" onClick={retry}>
              {t("retry")}
            </Button>
          }
        />
        {digest ? (
          <p className="text-caption text-muted-foreground" dir="ltr">
            {t("reference", { digest })}
          </p>
        ) : null}
      </div>
    </>
  )
}
