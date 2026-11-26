import { cn } from "@ritorno/ui/lib/utils"

type PageHeaderProps = {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  breadcrumb?: React.ReactNode
  className?: string
}

function PageHeader({ title, description, actions, breadcrumb, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {breadcrumb}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-prose min-w-0 flex-col gap-1.5">
          <h1 className="text-balance font-heading font-semibold text-2xl tracking-tight md:text-3xl">{title}</h1>
          {description ? <p className="text-pretty text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 *:max-md:grow">{actions}</div> : null}
      </div>
    </header>
  )
}

export { PageHeader }
