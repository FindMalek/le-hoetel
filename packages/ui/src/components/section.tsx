import { cn } from "@ritorno/ui/lib/utils"

type SectionProps = Omit<React.ComponentProps<"section">, "title"> & {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

function Section({ title, description, actions, className, children, ...props }: SectionProps) {
  return (
    <section className={cn("flex flex-col gap-4", className)} {...props}>
      {title || actions ? (
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            {title ? <h2 className="font-heading font-semibold text-lg tracking-tight">{title}</h2> : null}
            {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export { Section }
