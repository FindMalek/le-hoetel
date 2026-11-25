import { GUEST_SOURCES } from "@ritorno/common/consent"
import { getLocale, getTranslations } from "next-intl/server"
import type { CSSProperties } from "react"

const SWATCH: Record<(typeof GUEST_SOURCES)[number], string> = {
  qr_room: "bg-chart-3",
  qr_table: "bg-chart-2",
  qr_front_desk: "bg-chart-1",
  staff: "bg-foreground/60",
  csv: "bg-foreground/25",
}

type Point = { start: string; total: number; bySource: Record<(typeof GUEST_SOURCES)[number], number> }

/** Stacked bars in plain markup: no chart library, no client JS. The table below is the accessible version. */
export async function CapturedChart({ points, bySource }: { points: Point[]; bySource: Point["bySource"] }) {
  const [t, locale] = await Promise.all([getTranslations("metrics.captured"), getLocale()])
  const tSource = await getTranslations("guests.source")
  const max = Math.max(1, ...points.map((point) => point.total))
  const label = (start: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${start}T00:00:00Z`),
    )
  const used = GUEST_SOURCES.filter((source) => bySource[source] > 0)

  return (
    <figure className="flex flex-col gap-4">
      <div className="flex h-40 items-end gap-1 border-b md:gap-2" aria-hidden>
        {points.map((point) => (
          <div key={point.start} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className="flex h-(--bar) flex-col-reverse overflow-hidden rounded-t-sm"
              style={{ "--bar": `${(point.total / max) * 100}%` } as CSSProperties}
            >
              {GUEST_SOURCES.map((source) =>
                point.bySource[source] ? (
                  <div
                    key={source}
                    className={`grow-(--share) ${SWATCH[source]}`}
                    style={{ "--share": point.bySource[source] } as CSSProperties}
                  />
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 text-muted-foreground text-xs tabular-nums md:gap-2" aria-hidden>
        {points.map((point) => (
          <span key={point.start} className="min-w-0 flex-1 truncate text-center">
            {label(point.start)}
          </span>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {used.map((source) => (
          <li key={source} className="flex items-center gap-2">
            <span className={`size-3 rounded-sm ${SWATCH[source]}`} aria-hidden />
            {tSource(source)}
            <span className="text-muted-foreground tabular-nums">{bySource[source]}</span>
          </li>
        ))}
      </ul>
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
