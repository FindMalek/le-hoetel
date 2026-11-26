import { GUEST_SOURCES } from "@ritorno/common/consent"
import { Num } from "@ritorno/ui/components/num"
import { cn } from "@ritorno/ui/lib/utils"
import { getLocale, getTranslations } from "next-intl/server"
import type { CSSProperties } from "react"

type Source = (typeof GUEST_SOURCES)[number]

/** One palette color per source, so stacked segments never read as the same blue. */
const SWATCH: Record<Source, string> = {
  qr_front_desk: "bg-chart-1",
  qr_room: "bg-chart-3",
  qr_table: "bg-chart-4",
  staff: "bg-chart-5",
  csv: "bg-chart-2",
}

type Point = { start: string; total: number; bySource: Record<Source, number> }

type CapturedChartProps = {
  points: Point[]
  bySource: Point["bySource"]
  /** The home trend: one series, shorter, weekday labels, no legend. */
  compact?: boolean
}

/** Stacked bars in plain markup: no chart library, no client JS. The caption is the accessible version. */
export async function CapturedChart({ points, bySource, compact = false }: CapturedChartProps) {
  const [t, locale] = await Promise.all([getTranslations("metrics.captured"), getLocale()])
  const tSource = await getTranslations("guests.source")
  const max = Math.max(1, ...points.map((point) => point.total))
  const formatter = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, numberingSystem: "latn", timeZone: "UTC" })
  const long = formatter(compact ? { weekday: "short" } : { day: "numeric", month: "short" })
  const narrow = formatter(compact ? { weekday: "narrow" } : { day: "numeric" })
  const day = (start: string) => new Date(`${start}T00:00:00Z`)
  const label = (start: string) => long.format(day(start))
  const used = GUEST_SOURCES.filter((source) => bySource[source] > 0)

  return (
    <figure className="flex flex-col gap-3">
      <div className={cn("flex items-end gap-1.5 border-b md:gap-2", compact ? "h-32" : "h-48")} aria-hidden>
        {points.map((point) => (
          <div key={point.start} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className="flex h-(--bar) min-h-0.5 w-full max-w-16 flex-col-reverse self-center overflow-hidden rounded-t-sm bg-border"
              style={{ "--bar": `${(point.total / max) * 100}%` } as CSSProperties}
            >
              {compact
                ? point.total > 0 && <div className="grow bg-chart-1" />
                : GUEST_SOURCES.map((source) =>
                    point.bySource[source] ? (
                      <div
                        key={source}
                        className={cn("grow-(--share)", SWATCH[source])}
                        style={{ "--share": point.bySource[source] } as CSSProperties}
                      />
                    ) : null,
                  )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 text-caption text-muted-foreground md:gap-2" aria-hidden>
        {points.map((point, index) => (
          <span
            key={point.start}
            className={cn(
              "min-w-0 flex-1 truncate text-center",
              points.length > 7 && index % 2 === 1 && "max-md:invisible",
            )}
          >
            <span className="max-md:hidden">{label(point.start)}</span>
            <span className="md:hidden">{narrow.format(day(point.start))}</span>
          </span>
        ))}
      </div>
      {compact ? null : (
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-small">
          {used.map((source) => (
            <li key={source} className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", SWATCH[source])} aria-hidden />
              {tSource(source)}
              <Num value={bySource[source]} locale={locale} className="text-muted-foreground tabular-nums" />
            </li>
          ))}
        </ul>
      )}
      <figcaption className="sr-only">
        {t("summary", { count: points.reduce((sum, point) => sum + point.total, 0) })}
        <ul>
          {points.map((point) => (
            <li key={point.start}>
              {label(point.start)}: {point.total}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
