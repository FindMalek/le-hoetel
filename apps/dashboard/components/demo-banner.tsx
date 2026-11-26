import { EyeIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

/** Tells whoever holds the phone why nothing saves. Shares `data-viewing-banner` so `--app-header` grows with it. */
export async function DemoBanner() {
  const t = await getTranslations("shell")
  return (
    <p
      data-viewing-banner
      className="flex h-12 items-center gap-3 border-t bg-secondary px-4 text-secondary-foreground text-sm md:px-6"
    >
      <EyeIcon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{t("demoViewOnly")}</span>
    </p>
  )
}
