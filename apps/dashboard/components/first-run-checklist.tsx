import { cn } from "@ritorno/ui/lib/utils"
import { CheckIcon, ChevronRightIcon } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import type { CSSProperties } from "react"

const STEPS = [
  { key: "logo", href: "/hotel#logo" },
  { key: "colors", href: "/hotel#colors" },
  { key: "googleLink", href: "/hotel#google-review" },
  { key: "qr", href: "/qr-codes" },
  { key: "guests", href: "/guests/new" },
  { key: "testEmail", href: "/emails" },
] as const satisfies readonly { key: string; href: Route }[]

export type Checklist = Record<(typeof STEPS)[number]["key"], boolean>

// i18n-used: home.checklist
export async function FirstRunChecklist({ state }: { state: Checklist }) {
  const t = await getTranslations("home.checklist")
  const done = STEPS.filter((step) => state[step.key]).length
  if (done === STEPS.length) return null
  return (
    <section aria-labelledby="checklist-title" className="flex flex-col gap-4 rounded-card border bg-card p-5 md:p-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="checklist-title" className="text-h3">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-small">{t("description")}</p>
        </div>
        <span className="shrink-0 text-muted-foreground text-small tabular-nums">
          {t("progress", { done, total: STEPS.length })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={STEPS.length}
        aria-valuenow={done}
        aria-label={t("title")}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full w-(--progress) rounded-full bg-primary transition-[width] duration-200"
          style={{ "--progress": `${(done / STEPS.length) * 100}%` } as CSSProperties}
        />
      </div>
      <ul className="flex flex-col divide-y">
        {STEPS.map((step) => {
          const complete = state[step.key]
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className="-mx-2 flex min-h-12 items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    complete ? "border-primary bg-primary text-primary-foreground" : "border-dashed",
                  )}
                >
                  {complete && <CheckIcon className="size-3" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("font-medium text-small", complete && "text-muted-foreground")}>
                    {t(`${step.key}.title`)}
                  </span>
                  {!complete && <span className="text-caption text-muted-foreground">{t(`${step.key}.body`)}</span>}
                </span>
                <span className="sr-only">{t(complete ? "done" : "todo")}</span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
