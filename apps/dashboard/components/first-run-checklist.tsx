import { cn } from "@le-hoetel/ui/lib/utils"
import { CheckIcon, ChevronRightIcon } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

const STEPS = [
  { key: "logo", href: "/hotel" },
  { key: "colors", href: "/hotel" },
  { key: "googleLink", href: "/hotel" },
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
    <section aria-labelledby="checklist-title" className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="checklist-title" className="font-heading font-semibold text-lg tracking-tight">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <span className="shrink-0 text-muted-foreground text-sm tabular-nums">{t("progress", { done, total: STEPS.length })}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={STEPS.length}
        aria-valuenow={done}
        aria-label={t("title")}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${(done / STEPS.length) * 100}%` }} />
      </div>
      <ul className="flex flex-col divide-y">
        {STEPS.map((step) => {
          const complete = state[step.key]
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className="-mx-2 flex min-h-12 items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border",
                    complete && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {complete && <CheckIcon className="size-3.5" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("font-medium text-sm", complete && "text-muted-foreground line-through")}>{t(`${step.key}.title`)}</span>
                  {!complete && <span className="text-muted-foreground text-xs">{t(`${step.key}.body`)}</span>}
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
