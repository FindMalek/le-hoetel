import { cn } from "cn"

type ChartCardProps = {
  title: React.ReactNode
  description?: React.ReactNode
  /** Period picker or legend at the inline end of the header, usually a `SegmentedControl`. */
  control?: React.ReactNode
  /** Shown instead of the chart when there is nothing to plot. */
  empty?: React.ReactNode
  isEmpty?: boolean
  children: React.ReactNode
  className?: string
}

function ChartCard({ title, description, control, empty, isEmpty, children, className }: ChartCardProps) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-card border bg-card p-5 md:p-6", className)}>
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-h3">{title}</h2>
          {description ? <p className="text-muted-foreground text-small">{description}</p> : null}
        </div>
        {control ? <div className="shrink-0">{control}</div> : null}
      </header>
      {isEmpty ? empty : children}
    </section>
  )
}

export { ChartCard }
