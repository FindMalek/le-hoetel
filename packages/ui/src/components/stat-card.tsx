import { StatusBadge, type StatusTone } from "@ritorno/ui/components/status-badge"
import { cn } from "cn"
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react"

type StatDelta = {
  direction: "up" | "down" | "flat"
  /** The signed change, from `formatDelta` ("+12%"). Rendered left to right so the sign never flips. */
  value: React.ReactNode
  /** What it is compared to, e.g. "vs last 30 days". The arrow and tone only repeat the words. */
  context?: React.ReactNode
  /** Defaults to up good, down bad. Pass it when down is the good way (unsubscribes). */
  tone?: StatusTone
}

type StatCardProps = {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  delta?: StatDelta
  /** A link to the full list, e.g. `<Link href="/guests">See guests</Link>`. */
  link?: React.ReactNode
  className?: string
}

const DELTA = {
  up: { icon: ArrowUpIcon, tone: "success" },
  down: { icon: ArrowDownIcon, tone: "danger" },
  flat: { icon: ArrowRightIcon, tone: "neutral" },
} as const

function StatCard({ label, value, hint, icon, delta, link, className }: StatCardProps) {
  const Arrow = delta ? DELTA[delta.direction].icon : null
  return (
    <div className={cn("flex flex-col gap-2 rounded-card border bg-card p-5 md:gap-3 md:p-6", className)}>
      <div className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
        <span className="truncate">{label}</span>
        {icon ? <span className="shrink-0 [&_svg:not([class*='size-'])]:size-4">{icon}</span> : null}
      </div>
      <div className="text-h1 tabular-nums">
        <bdi dir="ltr">{value}</bdi>
      </div>
      {delta && Arrow ? (
        <StatusBadge
          tone={delta.tone ?? DELTA[delta.direction].tone}
          icon={<Arrow className={cn(delta.direction === "flat" && "rtl:rotate-180")} />}
        >
          <bdi dir="ltr">{delta.value}</bdi>
          {delta.context ? <span>{delta.context}</span> : null}
        </StatusBadge>
      ) : null}
      {hint ? <p className="text-muted-foreground text-small">{hint}</p> : null}
      {link ? <div className="mt-auto text-small">{link}</div> : null}
    </div>
  )
}

export { type StatDelta, StatCard }
