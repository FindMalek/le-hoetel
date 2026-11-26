import { cn } from "@ritorno/ui/lib/utils"

type StatCardProps = {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

function StatCard({ label, value, hint, icon, className }: StatCardProps) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border bg-card p-4 md:gap-3 md:p-5", className)}>
      <div className="flex items-center justify-between gap-2 text-muted-foreground text-sm">
        <span className="truncate">{label}</span>
        {icon ? <span className="shrink-0 [&_svg:not([class*='size-'])]:size-4">{icon}</span> : null}
      </div>
      <div className="font-heading font-semibold text-2xl tabular-nums md:text-3xl tracking-tight">{value}</div>
      {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
    </div>
  )
}

export { StatCard }
